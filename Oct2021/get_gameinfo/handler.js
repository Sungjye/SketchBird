//-------------------------------------------------------------------------------------
// Project: SketchBird
// DB: mysql.
// 
// 게임의 상태와 정보를 쿼리할 떄 쓰는 람다.
//
// 
// 2021.08.30. sjjo. Oh, MLJPHM PHMICFY
// 2021.09.14. sjjo. TossGame의 게임 진행중일 때를 짜고, 여기로 넘어옴. 
//                   이거 다 짜면, JS의 가이드에 따라, TossGame 게임 끝났을 때 경우 짜기. 
//             * 생각해 보니 이걸 제일 정신차리고 짜야할듯!
//               왜? 제일 자주 호출되고.. 이게 테이블 access 시간 제일 길듯. GameProgressTable.
// 2021.09.24. sjjo. 게임 끝낸 사용자 목록 만들기 작성중. 
//                   JS와 finishedUsers 에, startTimestamp는 쓰지않고 필드만 두는 것으로 협의. 
//                   진행중인 게임에 대해서는 (모의 데이터로) 게임정보 잘 얻어오는 것으로 확인 완료. 
//                   이제 남은건, 완료한 게임정보 가져오기인데, JS와 오프라인에서 만나서 같이 진행 예정. 
//
// 2021.09.28. sjjo. TossGame의 게임 끝났을 때 처리하다가, sendPush_v03 내부에서 nextUser 데이터를 
//                   FCM 날릴 때 쓰기 때문에, 이 함수를 게임 끝났을 때 fcm 날리기용으로 별도로 만들지 않으려면,
//                   좀, redundent 해도, nextUser를 최종 사용자로 채워서, 리스폰스 해준다. 
//                   아니다!! sendPush 게임 끝났을 때 용을 만들어야. 왜? 앱측에 리스폰스를 제대로 날리기 위해. 
//                   아니다, JS와 협의 해야지. 
//                   #종료게임용, // JS협의 202109.28
// 
// 2021.11.09. sjjo. (끝난게임에 대해서) 게임테이블의 turnCount(max) 과 게임프로그래스테이블 join 유저테이블 의 결과가 다른경우
//                    사용자의 데이터가 유저테이블에서 삭제된 경우에 그렇다. 일단 에러메시지에 해당 내용을 추가 함. 
//                    사실 이경우가 실제게임에서는 없어야 하는데. 탈퇴해도 체인유지를 위한 최소한의정보는 둬야. fcm토큰은 삭제하더라도.
//                    처리는?
//
//-------------------------------------------------------------------------------------

'use strict';

const mysql = require('mysql');

//--------------------------------------------------------------------------------------
// 0==일단만들어짐(첫토스이전), 1==진행중, 2==완료, 3==드롭, 4==뭔가 문제? 
// assign 되는 숫자 바꿀려면, CreateGame, TossGame, GetGameInfo 3군데 코드 다 바꿔야 함!
const CONST_GAME_STATUS__START = 0;
const CONST_GAME_STATUS__ING = 1;
const CONST_GAME_STATUS__END = 2;
const CONST_GAME_STATUS__DROP = 3;
const CONST_GAME_STATUS__ERR = 4;

function queryThisFromTheTable(query_string) {
  return new Promise((resolve, reject) => {
    // Mysql
    const mysql_connection = mysql.createConnection({
    host: 'sketchbird-01.c8wfnhiunwfj.ap-northeast-2.rds.amazonaws.com',
    port: 3306,
    user: 'sketchbirddb',
    password: 'coglix!!..',
    database: 'sketchbird'
    });

    mysql_connection.connect();

    mysql_connection.query(query_string, function(err, result, field) {
        if(result)
          resolve(result);
        
        if(err)
          console.log("[GetGameInfo] [ERROR]: db-error:",err);
    });
    mysql_connection.end();
  });
}

const isLocal = 0; // 아직 로컬 실행인지 확인하는 방법 모르겠다. 
// feat. JY.
// var os = require('os'); console.log( os.hostname() );
// 근데 이거 계속 부를 때마다 실행하는게 맞나? 실행시간.. 
// 일단 실행시간 써도될 꼭 필요한 경우만 쓰자. 
//---------------------------------
// 표준 response 를 보내기 위해. 
const sendRes = (status, rcv_body) => {
  let response = null;

  if( isLocal==0 )
  {
      response = {
          statusCode: status,
          headers: {
              "Content-Type" : "application/json",
              "Access-Control-Allow-Headers" : "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
              "Access-Control-Allow-Methods" : "OPTIONS,POST,PUT",
              "Access-Control-Allow-Credentials" : true,
              "Access-Control-Allow-Origin" : "*",
              "X-Requested-With" : "*"
          },
          body: rcv_body
      };
      return response;
  }else
  {
      // 이거!! CLI sls local 인 경우, 이거 해줘야 에러 안나고 실행된다. 
      // rcv_body는 사실상 JSON 인데. 
      // 뭔가 잘 이해는 안되지만, 실험적으로, 이렇게 해서 동작하게. 2021.08.17
      var str_body = JSON.stringify(rcv_body);

      response = {
        statusCode: status,
        headers: {
            "Content-Type" : "application/json",
            "Access-Control-Allow-Headers" : "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
            "Access-Control-Allow-Methods" : "OPTIONS,POST,PUT",
            "Access-Control-Allow-Credentials" : true,
            "Access-Control-Allow-Origin" : "*",
            "X-Requested-With" : "*"
        },
        body: str_body
    };
    return response;
  }  
};


module.exports.GetGameInfo = async (event) => {

  //#########################################################################
  //=========================================================================
  // 게임의 인덱스 (스트링)을 받아서, 각 테이블에서 정보를 가져와서, 
  // 다음의 스케치버드 표준 json을 구성해서 response
  //=========================================================================


  //-------------------------------------------------------------------------
  // 0. 받은 스트링 인덱스를 정수로 바꾸기. (연산시간 가장 빠른)
  //    : 그래야, 테이블에서 불러다 쓰지. 
  //    일단 이 레퍼를 주요하게 참조. 실행시간 등. https://flaviocopes.com/how-to-convert-string-to-number-javascript/
  //-------------------------------------------------------------------------
  const strGameIdx = event.gameIdx; // 이건 제이슨 리스폰스 할 때 씀.
  const intGameIdx = strGameIdx * 1;

  // 예외처리. 혹시나 잘못된 이름으로 request가 올때!
  if( strGameIdx == null )
  {
    const err_msg = "[GetGameInfo] [Serious Error!!] Invalid Request Data! event: " + JSON.stringify(event);
    console.log( err_msg );
    return sendRes(410, err_msg);
  }

  //-------------------------------------------------------------------------
  // 1. GameTable DB에서 게임의 기본 정보를 불러온다.   
  //    : 여기만 있는 게임 고유의 정보가 있거든. 
  //-------------------------------------------------------------------------
  // 조인 많이 해야해서, 그냥 바로 사용한다, 테이블 이름. let TABLE_NAME; 
  let queryResult = null; 

  try{


    //const query_getUserInfo = 'SELECT userIdx, fcmToken FROM UserTable WHERE userUid=\'' + sNextUserUid + '\' ;';

   
    // 2021.09.14. 일단 처음이니, 당장 필요한 것들만. 
    //const query_gameInfo = 'SELECT creatorIdx, turnCount, gameType, keywordIdx, status, createdTime, endTime FROM ' + TABLE_NAME + ' WHERE gameIdx=' + intGameIdx + ';';    

    // 조인할 대상. creatorIdx (userUid), keywordIdx keywordLanguage (keyword), ... 

    //-----------------------------------------------------------------------
    // 조인해서 한번에 [gameInfo 에 필요한 정보] 다 쿼리해오기 시도!! 2021. 09.14
    /*
    SELECT U.userUid, G.creatorIdx, G.turnCount, G.gameType, G.keywordLanguage, L.localizedKeyword, G.keywordIdx, G.status, G.createdTime
            FROM GameTable AS G INNER JOIN UserTable AS U ON G.creatorIdx = U.userIdx 
					  INNER JOIN LocalizedKeywordTable AS L ON G.keywordIdx = L.keywordIdx WHERE G.gameIdx=24 
                                                                                        AND G.keywordLanguage = L.lang;  
    */
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    // 조회 대상 테이블: GameTable, UserTable, LocalizedKeywordTable
    const query_gameInfo = 'SELECT U.userUid, G.creatorIdx, G.turnCount, G.gameType, G.keywordLanguage, L.localizedKeyword, G.keywordIdx, G.status, G.createdTime, G.endTime'
                            + ' ' + 'FROM GameTable AS G INNER JOIN UserTable AS U ON G.creatorIdx = U.userIdx'
                            + ' ' + 'INNER JOIN LocalizedKeywordTable AS L ON G.keywordIdx = L.keywordIdx WHERE G.gameIdx=' + intGameIdx
                                                                                                        + ' ' + 'AND G.keywordLanguage = L.lang;';

    queryResult= await queryThisFromTheTable(query_gameInfo);

    //console.log(queryResult);

  }catch(error)
  {
    console.log("[GetGameInfo] [Error] [GameTable] SELECT FAIL. DB Access or etc.:  " + " > " + error);
    return sendRes(400, error);
  }  

  //-------------------------------------------------------------------------
  // 1-1. 예외처리. 쿼리 결과가 단 1개가 아니면,  
  //      error 를 리스폰스 해야지!!  
  if( queryResult.length != 1 ) 
  {
    const err_msg = "[GetGameInfo] [Serious Error!!] There is no data of this gameIdx in GameTable!!! [GameTable, UserTable] gameIdx, NumOfDataInGameTable: " + intGameIdx + ", " + queryResult.length;
    console.log( err_msg );
    return sendRes(402, err_msg);
  }

  //------------------------------------------------------------------------
  // 1-2. 예외처리. 게임이 정상적인 게임이 아닐 경우. 
  //
  const intProgress = queryResult[0].status; // 0==일단만들어짐(첫토스이전), 1==진행중, 2==완료, 3==드롭, 4==뭔가 문제?
  if( intProgress <= CONST_GAME_STATUS__END )
  {
    ; // Do nothing.
  }else if( intProgress == CONST_GAME_STATUS__DROP )
  {
    const err_msg = "[GetGameInfo] [Dropped Game] This game is dropped game. gameIdx:" + intGameIdx ;
    console.log( err_msg );
    return sendRes(404, err_msg);
  }else 
  {
    const err_msg = "[GetGameInfo] [Abnormal Game] This game data is abnormal. gameIdx:" + intGameIdx + ", GameProgressTable.status: " + intProgress;
    console.log( err_msg );
    return sendRes(403, err_msg);
  }


  const strCreatedUserId = queryResult[0].userUid;
  const intCreatorIdx = queryResult[0].creatorIdx;
  let intCurrentTurn = null; // OK 2021.09.24. TBD. GameProgressTable 에서 어떻게든 얻어와야 하지 않겠음? 배열의 개수라던지. 
  const intMaximumTurn = queryResult[0].turnCount;
  const intGameType = queryResult[0].gameType;
  const strKeywordLanguage = queryResult[0].keywordLanguage; // 각고의 3중 조인의 열매.
  const strKeyword = queryResult[0].localizedKeyword; // 각고의 3중 조인의 열매.
  const intKeywordIdx = queryResult[0].keywordIdx;
  let strCategory = null; // 지금은 아직 사용안하므로. 2021.09.14
  
  const dateCreatedTime = queryResult[0].createdTime;
  const dateEndTime = queryResult[0].endTime;

  // #종료게임용 별도 처리필요!
  let intNextUserIdx = null; // 프로그래스 테이블 쿼리한 뒤에 찾아서 넣을 수 있다. 
  let intNextUserTurnNum = null; // 마찬가지로, 프로그래스 테이블 쿼리 한 뒤에 넣을 수 있다. 
  let strNextUserDrawType = null; // 다음사용자의 그리기 타입. 가장 최근에 게임을 끝낸 사람의 타입을 사용해서, 추정. 
  let strNextUserTossTimestamp = null; // 다음사용자가 토스 받은 시간. 가장 최근에 게임을 끝낸 사람이 토스한 시간을 기록. 

  // 2021.09.28 안보여서 위치 옮김. 
  let strNextUserUid = null;
  let strNextUserNickname = null;
  let intNextUserGender = null;
  let intNextUserAgeRange = null;
  let strNextUserPushToken = null;
  let strNextUserCountry = null;
  let strNextUserUserLanguage = null;


  //#########################################################################
  // intProgress 를 확인해서, 
  //   진행중인 게임과 (nextUser 정보 있게) 
  //   끝난게임을 다르게(nextUser 정보없이)
  // 구성해서 response 해야 한다!!
  //#########################################################################

  //-------------------------------------------------------------------------
  // 2. GameProgressTable 을 쿼리해서, 다음 2가지 종류의 정보를 다 구성해 내야 한다. 
  //    : fisnishedUsers, nextUser
  // Array List를 활용하자!
  //
  // HERE! 2021.09.14
  // 테스트는, CreateGame 된 게임 목록중, 그 번호를 선택해서 toss를 2번하고, progresss table을 조인해서 확인. 
  //-------------------------------------------------------------------------
  try{

    //-------------------------------------------------------------------------
    // 2-1. 쿼리하면, 진행된 턴수만큼의 행의 개수가 나올텐데... 
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    // 조회 대상 테이블: GameProgressTable, UserTable

    // 2021.09.23 
    // 기존 호환위한 제이슨 안 만들고, 단지 현재 게임만을 표시하기 위한 거면 JOIN 안해도 될듯. 
    // 일단, 지금은 JOIN 해서 하는 걸로. 협의되기 전이니, 돌려야 함. 
    const query_progressInfo = 'SELECT U.userUid, P.userIdx, U.nickName, U.gender, U.ageRange, U.fcmToken, P.currentRegion, U.userLanguage, '
                                + 'P.turnNumber, P.nextUserIdx, P.drawType, P.imageUrl, P.tossedTime'
                                + ' ' + 'FROM GameProgressTable AS P'
                                + ' ' + 'INNER JOIN UserTable AS U'
                                + ' ' + 'ON P.userIdx = U.userIdx'
                                + ' ' + 'WHERE P.gameIdx = ' + intGameIdx + ';';

    queryResult = await queryThisFromTheTable(query_progressInfo);
    //console.log(queryResult);
   
  }catch(error)
  {
    //-------------------------------------------------------------------------
    // 2-2. 조회 자체가 안된 경우. 
    console.log("[GetGameInfo] [Error] [GameProgressTable, UserTable] SELECT FAIL. DB Access or etc.:  " + " > " + error);
    return sendRes(400, error);
  }

  // 쿼리해 온 결과의 개수를 저장하고,
  const intNumOfFinishedUsers = queryResult.length;
  

  //-------------------------------------------------------------------------
  // 2-3. 예외처리 1차. 쿼리 결과가, maximumTurn 보다 크다면 뭔가 잘못된 거니, 
  //      error 를 리스폰스 해야지!!  
  if( intNumOfFinishedUsers > intMaximumTurn )
  {
    const err_msg = "[GetGameInfo] [Serious Error!!] The number of the finishedUsers is bigger than the max turn number!!! [GameProgressTable, UserTable]";
    console.log( err_msg );
    return sendRes(402, err_msg);
  }
  if( intNumOfFinishedUsers == 0 ) // 결과가 하나도 없을 경우. 
  {
    const err_msg = "[GetGameInfo] [Serious Error!!] There is no data of this gameIdx!!! [GameProgressTable, UserTable] : " + intGameIdx;
    console.log( err_msg );
    return sendRes(402, err_msg);
  }

  //-------------------------------------------------------------------------
  // 2-4. 자, 뭘가져 왔나. 잘 넣어보자. 
  // TOSS 시간은, 어느사람인가 기준이 중요하므로, 실제로 돌려가며 확인 잘하자. 

  let arrayFinishedUsersData = new Array(); // Ref. https://stickie.tistory.com/62

  for(var idx=0; idx < intNumOfFinishedUsers; idx++)
  {

    // 지금 DB에서 TossGame 이 호출된 시점에서 타임스탬프 찍는거 말고는 따로 없으므로, 
    // 토스타임으로, 사용자의 시작시간과 끝낸시간을 계산한다. 
    // 즉, 토스 받은 시점이 자신의 시작시간. 토스 넘긴 시점이 자신의 종료시간. 
    // # 실제 토스하면서는, 
    //   첫 토스인 경우, 시작시간을 게임 만든시간, 종료시간을 다음사람에게 토스한 시간. 
    //   두번째 이후부터는, 시작시간을 '이전사람에게' 토스 받은시간, 종료시간을 다음 사람에게 토스한 시간.
    //   으로 나눠서 코딩하면 되겠다. 
    // 2021.09.24
    // JS와 startTimestamp는 쓰지않고 필드만 두는 것으로 협의. 


    // 앱단에서의 (이전협의) 요청으로, 그리기 타입, draw, word는 DB에 저장된 int 0, 1 이 아니라, 
    // string 으로 변환해서 제이슨으로 구성. 
    const intUserDrawType = queryResult[idx].drawType; // 0 == draw 그릴 차례, 1 == word 단어를 맞출(쓸) 차례.
    let strUserDrawType; 
    switch( intUserDrawType ){ 
      case 0: 
        strUserDrawType = 'draw';  
        break;
      case 1:
        strUserDrawType = 'word';
        break;
      default:
        const err_msg = "[GetGameInfo] [Serious Error!!] queryResult[idx].drawType is unknown data: " + intUserDrawType;
        console.log( err_msg );
        return sendRes(402, err_msg);
        break;
    } 

    if( idx == 0 ) // 첫번째 플레이어, 즉, 게임을 만든 사람이면,
    {
        // 토스받은 시간이 없으므로, 자신이 게임을 만든시간을 토스 받은 시간으로 생각, 
        // 즉 끝낸시간은 다른사람에게 토스한 시간으로 넣는다. 
        arrayFinishedUsersData.push(
          {
            id: queryResult[idx].userUid,
            userIdx: queryResult[idx].userIdx,
            nickname: queryResult[idx].nickName,
            gender: queryResult[idx].gender,
            ageRange: queryResult[idx].ageRange, 
            pushToken: queryResult[idx].fcmToken,
            country: queryResult[idx].currentRegion,
            userLanguage: queryResult[idx].userLanguage,
            turnNum: queryResult[idx].turnNumber,
            type: strUserDrawType,
            imgUrl: queryResult[idx].imageUrl,
            tossTimestamp: dateCreatedTime,
            startTimestamp: null,
            finishTimestamp: queryResult[idx].tossedTime
          }
        );        

    }else // 나머지 플레이어.
    {
        // 이건 지금, 제이슨 구조에서 이름이 좀 이상한데, 
        // 해당 사람이 그린시간을 계산하려면, 
        // tossTimestamp 는 본인이 (다른 사람으로부터) 토스 받은 시간을 넣고, 
        // finishedTimestamp 는 본인이 (다른사람 에게) 토스한 시간을 넣는것으로 하자. 
        arrayFinishedUsersData.push(
          {
            id: queryResult[idx].userUid,
            userIdx: queryResult[idx].userIdx,
            nickname: queryResult[idx].nickName,
            gender: queryResult[idx].gender,
            ageRange: queryResult[idx].ageRange, 
            pushToken: queryResult[idx].fcmToken,
            country: queryResult[idx].currentRegion,
            userLanguage: queryResult[idx].userLanguage,
            turnNum: queryResult[idx].turnNumber,
            type: strUserDrawType,
            imgUrl: queryResult[idx].imageUrl,
            tossTimestamp: queryResult[idx-1].tossedTime,
            startTimestamp: null,
            finishTimestamp: queryResult[idx].tossedTime
          }
        );

    }

    // 맨 마지막 사용자는 별도 처리 필요없겠지? 2021.09.24

    if( intProgress == CONST_GAME_STATUS__ING ) // 게임이 진행중일 경우만, 인덱싱해서 넥스트유저 데이터 만들어야 함. 
    {
      //-----------------------------------------------------------------------------------
      // 쿼리해서 가져온 데이터 배열 중에서, "마지막 것"의 turnNum을 확인하면, 이것이 현재턴수. 
      // 그리고 다음 사람은, 게임 전체의 다음 사람. 
      //-----------------------------------------------------------------------------------
      
      if( intNumOfFinishedUsers == (idx+1) ) // #종료게임용 별도 처리필요!
      {
        // 배열개수에서도 계산할 수 있겠지만, 이게 더 정확히(앱에서의 동작도) 확인하는 것이지.
        // 커런트 턴은, 다음 차례 할 사람의 턴이다! 그래서 + 1.
        intCurrentTurn = queryResult[idx].turnNumber + 1; // 게임을 끝낸 최종 사용자의 턴수에, 플러스 1을 한것이 다음 사람의 턴수. 
        intNextUserTurnNum = intCurrentTurn; // 메모리 몇 바이트에 가독성 얻기. 

        // 가장 최근에 끝난 사용자가 다음 사람으로 지정한 그 사람이, 게임 전체의 nextUser.
        intNextUserIdx = queryResult[idx].nextUserIdx;

        // 다음 사용자의 그리기 타입을, 가장 최근 완료한 사람을 통해 얻기. 
        // 가장 최근 사용자가 0 이면 다음사람은 1, 1 이면 0. 
        // 0 == draw 그릴 차례, 1 == word 단어를 맞출(쓸) 차례.

        // 이미 이 값은 위에서 들어가 있다. intUserDrawType
        switch( intUserDrawType ){ 
          case 0: 
            strNextUserDrawType = 'word'; //'draw'; // 다음 사람을 위한 계산이므로, 그 다음 타입을 넣어야 함. 
            break;
          case 1:
            strNextUserDrawType = 'draw'; //'word'; // 다음 사람을 위한 계산이므로, 그 다음 타입을 넣어야 함. 
            break;
          default:
            const err_msg = "[GetGameInfo] [Serious Error!!] queryResult[idx].drawType is unknown data: " + intUserDrawType;
            console.log( err_msg );
            return sendRes(402, err_msg);
            break;
        } 

        // 가장 최근에 끝낸 사용자가 finished 한 시간이 다음 사용자의 toss 타임스탬프. 
        strNextUserTossTimestamp = queryResult[idx].tossedTime;

      }  
    }
        
    } // END of for loop.



    if( intProgress == CONST_GAME_STATUS__END ) // 2021.09.28 넥스트유저 관련 처리가 달라서, 나눠서 작성. 
    {
      // 끝난 경우에는 넥스트유저를 (앞에서 채운) null 그대로 보낸다. 
      
      intCurrentTurn = intNumOfFinishedUsers; // 이 값이랑 당연히 일치하겠지?

      // 예외 처리. 
      if( intNumOfFinishedUsers != intMaximumTurn )
      {
        //const err_msg = "[GetGameInfo] [Serious Error!!] End Game. The number of the finishedUsers is not equal to maximumTurn. [GameProgressTable, UserTable]";
        const err_msg = "[GetGameInfo] [Serious Error!!] End Game. The number of the finishedUsers is not equal to maximumTurn. #Some user might be DELETED in the UserTable.# [GameProgressTable, UserTable]"
                        + "intMaximumTurn(from GameTable): " + intMaximumTurn + ", intNumOfFinishedUsers(from GameProgessTable(joined)): " + intNumOfFinishedUsers;
        console.log( err_msg );
        return sendRes(402, err_msg);
      }

    } else // 진행중인 게임의 경우. 드롭이나 에러 경우에는 시작부에서 이미 에러 리스폰스로 걸렀다. 2021.09.28
    {      

      //-------------------------------------------------------------------------
      // 2-5. 예외처리 2차. 쿼리 결과가, currentTurn 과 같지 않다면, 뭔가 잘못된 거니, 
      //      error 를 리스폰스 해야지!!  
      // 물론! 이 경우는 게임이 진행중인 경우를 가정함!
      if( (intNumOfFinishedUsers + 1) != intCurrentTurn ) // 커런트 턴은, 다음 사용자 까지 포함한 턴수 이므로, + 1
      {
        const err_msg = "[GetGameInfo] [Serious Error!!] The number of the finishedUsers is not equal to the number of rows in DB!!! [GameProgressTable, UserTable]";
        console.log( err_msg );
        return sendRes(402, err_msg);
      }


      //-------------------------------------------------------------------------
      // 3. 지정된 다음 플레이어의 정보를 UserTable 에서 쿼리해서, 다음 정보를 구성. 
      //    nextUser
      //-------------------------------------------------------------------------
      // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
      // 조회 대상 테이블: UserTable
      try{
        //-------------------------------------------------------------------------
        // 3-1. 게임 전체의 다음 플레이어 정보를 쿼리해 옴. 
        const query_nextUserInfo = 'SELECT userUid, nickName, gender, ageRange, fcmToken, region, userLanguage'
                                    + ' ' + 'FROM UserTable'
                                    + ' ' + 'WHERE userIdx = ' + intNextUserIdx + ';';

        queryResult = await queryThisFromTheTable(query_nextUserInfo);
      
      }catch(error)
      {
        //-------------------------------------------------------------------------
        // 3-2. 조회 자체가 안된 경우. 
        console.log("[GetGameInfo] [Error] [UserTable] SELECT FAIL. DB Access or etc.:  " + " > " + error);
        return sendRes(400, error);
      }

      if( queryResult.length != 1 ) // 단 한명의 데이터가 아닐경우. 
      {
        const err_msg = "[GetGameInfo] [Serious Error!!] There no data or more than 1 of this userIdx: " + intNextUserIdx + ". Result num of data: " + queryResult.length;
        console.log( err_msg );
        return sendRes(402, err_msg);    
      }
      /*
      // 앞에서 이미 넣은 데이터들.
      let intNextUserIdx = null; 
      let intNextUserTurnNum = null;
      let strNextUserDrawType = null; 
      let strNextUserTossTimestamp = null; 
      */
      strNextUserUid = queryResult[0].userUid;
      // intNextUserIdx
      strNextUserNickname = queryResult[0].nickName;
      intNextUserGender = queryResult[0].gender;
      intNextUserAgeRange = queryResult[0].ageRange;
      strNextUserPushToken = queryResult[0].fcmToken;
      strNextUserCountry = queryResult[0].region;
      strNextUserUserLanguage = queryResult[0].userLanguage;
      // intNextUserTurnNum
      // strNextUserDrawType
      // imgUrl 은 null. 당연히 그리지 않았을 테니. 
      // strNextUserTossTimestamp // 이건, 이전 사람에게서 토스 받은 시간. 즉 이전 사람이 이 사람에게 토스한 시간. 
      // startTimestamp 는 현재 2021.09.24 쓰지 않기로 협의해서 null.
      // finishedTimestamp 는 아직 그리지도 않았으니 null. 

    } // End of else.  게임인 진행중인 경우, 즉 nextUser 데이터를 만들어 줘야 하는 경우 


  //-------------------------------------------------------------------------
  // 이제 다 끝났나? 2021.09.24
  //    : 
  //-------------------------------------------------------------------------



// Keyword table 조인해서, 사용자가 설정된 다국어 언어로 가져오는 것은 나중에 하자. ㅜ_ㅠ 2021. 09.14


const return_body = {
  gameInfo: {
    /* dynamo db 버전연동의 json 과 호환을 유지하기 위해 이름을 id로. 자동증가 되는 game의 uid index. unsigned int. */
    id: strGameIdx, 
    createdUserId: strCreatedUserId,
    creatorIdx: intCreatorIdx,        
    currentTurn: intCurrentTurn, /* 만든사람의 회차. 정하기 나름. */
    maximumTurn: intMaximumTurn,
    gameType: intGameType, /* 숫자로. 0 friend 아는 사람끼리, 1 everyone 모르는 (모든) 사람끼리 */
    keywordLanguage: strKeywordLanguage,
    keyword: strKeyword, 
    keywordIdx: intKeywordIdx,
    category: strCategory, /* 아직은 사용하지 않으므로 2021.09.02 */
    progress: intProgress,
    createdTime: dateCreatedTime /* 얻어와서 쓰자. 시간. 2021.09.08 */ /* 첫 토스가 이루어지는 시점에서, 데이터 제대로 구성. 비용도 쓰고. DB에서 비용들여서 가져와? 아님 첫 toss 하면 어차피 붙으니, 첫 toss 하기 전까지 필요없으면 가져오지 말자. */
    },
  finishedUsers: 
    arrayFinishedUsersData
    ,
  nextUser: {
    id: strNextUserUid, 
    userIdx: intNextUserIdx,
    nickname: strNextUserNickname,
    gender: intNextUserGender,
    ageRange: intNextUserAgeRange,
    pushToken: strNextUserPushToken,
    country: strNextUserCountry,
    userLanguage: strNextUserUserLanguage,
    turnNum: intNextUserTurnNum,
    type: strNextUserDrawType,
    imgUrl: null,
    tossTimestamp: strNextUserTossTimestamp,
    startTimestamp: null,
    finishTimestamp: null    
  },
  sys: {
    createdTimestamp: dateCreatedTime, /* 얻어와서 쓰자. 시간. 2021.09.08 */ /* DB에서 비용들여서 가져와? 아님 첫 toss 하면 어차피 붙으니, 첫 toss 하기 전까지 필요없으면 가져오지 말자. */
    endTimestamp: dateEndTime
    },
  timezone: -25200 // TBD.
    };


  // Tentative. 2021.09.23
  return sendRes(200, return_body);



  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // return { message: 'Go Serverless v1.0! Your function executed successfully!', event };
};
