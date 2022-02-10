//-------------------------------------------------------------------------------------
// Project: SketchBird
// DB: mysql.
// 
// 나는 이미 내 턴을 완료한 상태에서, (아직 안하고 있는) 바로 다음 사람에게 '조르기' 노티 날리는 람다.
//
// 
// 2021.10.28. sjjo. Initial. TossGame에서 참조. 
//
// 2021.11.09. sjjo. 게임인덱스를 기존 스트링(앱) 인트(람다및sql테이블) 혼용에서, 인트 로 통일. JY요청. 
//
// 2021.12.28. sjjo. mysql2 pool 적용. 이건 기본은 되는데 전체 흐름상에서 테스트 필요. 
//
// 2022.01.13. sjjo. FCM 메시지에 다음을 추가. JY 요청. FCM 메시지를 앱단에서 구분하기 위해. 
//                   '"datatype" : "JORUGI"' // JORUGI, DELEGATE, ING, FINISHED 
//
// 2022.01.21. sjjo. FCM 메시지에, 조르기 받은 사람이 바로 플레이 할 수 있도록 json 정보 자체를 실어서 보냄. (넘기기 람다와 유사하게)
//                   안되겠다. V3으로 가자. 

// 2022.01.21. sjjo. BegNextUserV2 람다에서 파생. 첫 deploy.
//
// ## 조르기 하는 사용자가 탈퇴해 버리거나, 뭔가의 이유로 쿼리 안되는 경우에 대한 처리 필요! ##
// 
//-------------------------------------------------------------------------------------

'use strict';

// 로그 안 찍히게 하기. 
console.logDebug = function() {};
/*
var log = console.log;
console.logDebug = function() {
  log.apply(console, arguments);
  // Print the stack trace
  //console.trace();
};
*/


// 스케치버드 app auth. 
const authHeader = 'key=AAAAV4RN8sw:APA91bHXNh3Xks6o1bZMlabRX52TFTeuT1CUlmHCmPKs-smY3Xgtn2mYClXi0netKd4LZ2ThSLF9Y9vAvOQdFM-5HVNMZdjQ9V3RuAFJ-hAVoJ2ICb1Mn79TdNCfwrTkQhzRsOBupnfa';

const ERR_NOT_RCV_JORUGI_OR_NO_USER = 1;

// get the client
const mysql = require('mysql2');
//const mysql = require('mysql2/promise');

// Create the connection pool. The pool-specific settings are the defaults
const pool = mysql.createPool({
  host: 'sketchbird-01.c8wfnhiunwfj.ap-northeast-2.rds.amazonaws.com',
  port: 3306,
  user: 'sketchbirddb',
  password: 'coglix!!..',
  database: 'sketchbird',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});


//--------------------------------------------------------------------------------------
// 가독성이 생기도록, 가져오려는 게임의 상태를 상수로. 
// 
// 0==일단만들어짐(첫토스이전), 1==진행중, 2==완료, 3==드롭, 4==뭔가 문제? 
// assign 되는 숫자 바꿀려면, CreateGame, TossGame, GetGameInfoV2 3군데 코드 다 바꿔야 함!
//--------------------------------------------------------------------------------------
const CONST_GAME_STATUS__START = 0;
const CONST_GAME_STATUS__ING = 1;
const CONST_GAME_STATUS__END = 2;
const CONST_GAME_STATUS__DROP = 3;
const CONST_GAME_STATUS__ERR = 4;


async function queryThisFromTheTable( query_str ){
  return new Promise( (resolve, reject) => {

    pool.query(query_str, function(err, result, fields) {
      if(result)
      {
          resolve(result);
      }
      if(err)
      {
          const errMsg = "[GivePressureNextUserV2] [ERROR]: db-error:" + err;
          console.log(errMsg);
          reject(errMsg);
      }

      // Connection is automatically released when query resolves
      // https://www.npmjs.com/package/mysql2
      // 쿼리가 리졸브 되면 자동 릴리즈 된단다.. 흠..
    });

  }
  );
}
/* 위의 코드가 나중에라도 문제되면 이 코드 참고해서 바꿔보자. 2021.11.30
// https://www.npmjs.com/package/mysql2
Alternatively, there is also the possibility of manually acquiring a connection from the pool and returning it later:

// For pool initialization, see above
pool.getConnection(function(err, conn) {
   // Do something with the connection
   conn.query( ... );
   // Don't forget to release the connection when finished!
   pool.releaseConnection(conn);
})
*/


const isLocal = 0; // 아직 로컬 실행인지 확인하는 방법 모르겠다. 
//
const sendRes = (status, rcv_body) => {
  let response=null;

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
      // return response;
      // 정상 리스폰스가 아니면 에러를 쓰로우. 
      if( (status >= 200) && (status < 300) )
      {
        return response;
      }else
      {
        //throw new Error(response);
        throw new Error(JSON.stringify(response));
      }

  }else
  {
      // 이거!! CLI sls local 인 경우, 이거 해줘야 에러 안나고 실행된다. 
      // rcv_body는 사실상 JSON 인데. 
      // 뭔가 잘 이해는 안되지만, 실험적으로, 이렇게 해서 동작하게. 2021.08.17
      //var str_body = rcv_body;
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

      // 정상 리스폰스가 아니면 에러를 쓰로우. 
      if(status == 200)
      {
        return response;
      }else
      {
        //throw new Error(response);
        throw new Error(JSON.stringify(response));
      }      
  }  
};

//===========================================================================
// FCM 날리는 부. Ver. 04. 2022.01.06
// 이제 게임이 진행중일 때 필요한 것은, 게임정보, 가장 최근플레이한 정보 1인분, 다음사람 정보 1인분 뿐이므로,
// 다시, fcm 날릴 때, 데이터 부분에, 리퀘스트 받은 JSON 전체를 보닌다. 
// 거기에, return도 성공시, 보낸 userUid string 만. (리스폰스는 동일?!)
// 
// 이것을, 넘기기 용으로 다시 만지기.. 2022.01.13
//===========================================================================
function sendPush_v04(event, token) {

  const https = require('https');
  

  // 진행중 게임용으로 다시 살림. 2021.09.28
  // 나중에 gameInfo에 언어코드 읽어서, 언어별로 해주면 되지. 
  const inggame_title = "SketchBird: 짹짹!!";

  //const inggame_body = event.finishedUsers[(event.gameInfo.currentTurn-2)].nickname + " 에게서 그림쪽지가 도착했어요!";  
  //const inggame_body = event.finishedUsers[0].nickname + " 에게서 DELEGATED 그림쪽지가 도착했어요!";  
  const inggame_body = "뒤에서 엄청 기다리고 있다요!";  
  
  
  const str_event = JSON.stringify(event); // 추가 해야함? 이렇게 해야 FCM이 제대로 날아감.

  const reqMiniBody = '{"to":"' + token +'",' +
  '"priority" : "high",' +
  '"notification" : {' +
    '"title": "' + inggame_title +'",'+ 
    '"image": "' + event.finishedUsers[0].imgUrl +'",'+
    '"click_action" : "FLUTTER_NOTIFICATION_CLICK",'+ 
    '"body": "' + inggame_body + '"'+
  '},' +
  '"data" : {'+
      '"click_action" : "FLUTTER_NOTIFICATION_CLICK",'+
      '"screen" : "/game/receive", '+
      '"datatype" : "JORUGI"'+
      '"json":' + str_event +
    '}'+
  '}';

  // JORUGI, DELEGATE, ING, FINISHED
                                 
                                      
  // 역슬래시 문제 해결 위해. 2021.09.14 rendRes 할때 스트링기파이 같이 한다, local 에서만. 
  //    remote는 안하고 붙여야 역슬래시 안생긴다.
  const responseData = {
      id: event.nextUser.id,
      msg: 'FCM Sending is successful.'
  };
                                        

  return new Promise((resolve, reject) => {
      
      //-------------------
      // FCM 날리는 부분. 
      const options = {
          host: 'fcm.googleapis.com',
          path: '/fcm/send',
          method: 'POST',
          headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/json',
          },
      };
  
      // 쓸데없는 log 는 빼자. console.log(options);
      const req = https.request(options, (res) => {
          //console.log('success');
          //console.log(res.statusCode);
          //resolve('success yo');
          // 2021.09.13. resolve(str_wo_slash_event);
          resolve(responseData);
          
      });
  
      req.on('error', (e) => {
          console.log('[GivePressureNextUserV2] @@@ :( [FCM Sending] failure' + e.message);
          reject(e.message);
      });
      
              
      // 쓸데없는 log 는 빼자. console.log(reqMiniBody);

      req.write(reqMiniBody);
      req.end();
  });
      
}

module.exports.GivePressureNextUserV2 = async (event) => {

//#########################################################################  
//-------------------------------------------------------------------------
// [STEP 0]. 넘어온 값이 널임?...
//-------------------------------------------------------------------------
//#########################################################################
if( event.gameIdx == null )
{
  const strInfoMsg = '[GivePressureNextUserV2] [Error] Null data!!!: ' 
                        +'gameIdx: ' + event.gameIdx;
  console.log(strInfoMsg);
  sendRes(402, strInfoMsg);

}  


//#########################################################################
//-------------------------------------------------------------------------
// [STEP 1]. 넘어온 정보로, 조르기 할 사용자에게 토스할 json을 구성.
//-------------------------------------------------------------------------
//#########################################################################

//=========================================================================
// 0. 받은 event에서 기본적으로 필요한 정보를 분류한다. 
//    가독성 위해서.
//=========================================================================
const intGameIdx = event.gameIdx;
let queryResult = null;
let strNextUserFcmToken = null;
let strNextUserNickname = null;



//=========================================================================
// 1. 받은 event 정보를 가지고, TossGameV4의 리퀘스트 포맷으로 쓸 수 있는 json을 구성해 내기.
// 
//=========================================================================

  //-------------------------------------------------------------------------
  // 1. GameTable DB에서 게임의 기본 정보를 불러온다.   
  //    : 여기만 있는 게임 고유의 정보가 있거든. 
  //-------------------------------------------------------------------------
  // 조인 많이 해야해서, 그냥 바로 사용한다, 테이블 이름. let TABLE_NAME; 

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
    const err_msg = "[GivePressureNextUserV2] [Error] [GameTable] SELECT FAIL. DB Access or etc.:  " + " > " + error;
    console.log(err_msg);
    return sendRes(400, err_msg);
  }  

  //-------------------------------------------------------------------------
  // 1-1. 예외처리. 쿼리 결과가 단 1개가 아니면,  
  //      error 를 리스폰스 해야지!!  
  if( queryResult.length != 1 ) 
  {
    const err_msg = "[GivePressureNextUserV2] [Serious Error!!] There is no data of this gameIdx in GameTable!!! [GameTable, UserTable] gameIdx, NumOfDataInGameTable: " + intGameIdx + ", " + queryResult.length;
    console.log( err_msg );
    return sendRes(402, err_msg);
  }

  //------------------------------------------------------------------------
  // 1-2. 예외처리. 게임이 정상적인 게임이 아닐 경우. 
  //
  const intProgress = queryResult[0].status; // 0==일단만들어짐(첫토스이전), 1==진행중, 2==완료, 3==드롭, 4==뭔가 문제?
  //if( intProgress <= CONST_GAME_STATUS__END )
  if( intProgress < CONST_GAME_STATUS__END ) // 이제 끝난 게임은, 처리하면 안된다. 왜? 넘기기 는 진행중인 게임만 가능하므로.
  {
    ; // Do nothing.
  }else if( intProgress == CONST_GAME_STATUS__DROP )
  {
    const err_msg = "[GivePressureNextUserV2] [Dropped Game] This game is a dropped game. gameIdx:" + intGameIdx ;
    console.log( err_msg );
    return sendRes(410, err_msg);
  }
  else if( intProgress == CONST_GAME_STATUS__END )
  {
    const err_msg = "[GivePressureNextUserV2] [End(ed) Game] This game is a finished game. gameIdx:" + intGameIdx ;
    console.log( err_msg );
    return sendRes(410, err_msg);    
  }else 
  {
    const err_msg = "[GivePressureNextUserV2] [Abnormal Game] This game data is abnormal. gameIdx:" + intGameIdx + ", GameProgressTable.status: " + intProgress;
    console.log( err_msg );
    return sendRes(410, err_msg);
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
  let intOrigianl_NextUserIdx = null; // 딜리게이트게임 용으로 추가. 2022.01.19 에러, 예외 처리용. 

  let intNextUserTurnNum = null; // 마찬가지로, 프로그래스 테이블 쿼리 한 뒤에 넣을 수 있다. 
  let strNextUserDrawType = null; // 다음사용자의 그리기 타입. 가장 최근에 게임을 끝낸 사람의 타입을 사용해서, 추정. 
  let strNextUserTossTimestamp = null; // 다음사용자가 토스 받은 시간. 가장 최근에 게임을 끝낸 사람이 토스한 시간을 기록. 

  // 2021.09.28 안보여서 위치 옮김. 
  let strNextUserUid = null;
  // 이미 선언. let strNextUserNickname = null;
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
    const errStr = "[GivePressureNextUserV2] [Error] [GameProgressTable, UserTable] SELECT FAIL. DB Access or etc.:  " + " > " + error;
    console.log( errStr );
    return sendRes(400, errStr);
  }

  // 쿼리해 온 결과의 개수를 저장하고,
  const intNumOfFinishedUsers = queryResult.length;
  

  //-------------------------------------------------------------------------
  // 2-3. 예외처리 1차. 쿼리 결과가, maximumTurn 보다 크다면 뭔가 잘못된 거니, 
  //      error 를 리스폰스 해야지!!  
  if( intNumOfFinishedUsers > intMaximumTurn )
  {
    const err_msg = "[GivePressureNextUserV2] [Serious Error!!] The number of the finishedUsers is bigger than the max turn number!!! [GameProgressTable, UserTable]";
    console.log( err_msg );
    return sendRes(402, err_msg);
  }
  if( intNumOfFinishedUsers == 0 ) // 결과가 하나도 없을 경우. 
  {
    const err_msg = "[GivePressureNextUserV2] [Serious Error!!] There is no data of this gameIdx!!! [GameProgressTable, UserTable] : " + intGameIdx;
    console.log( err_msg );
    return sendRes(402, err_msg);
  }

  //-------------------------------------------------------------------------
  // 2-4. 자, 뭘가져 왔나. 잘 넣어보자. 
  // TOSS 시간은, 어느사람인가 기준이 중요하므로, 실제로 돌려가며 확인 잘하자. 

  let arrayFinishedUsersData = new Array(); // Ref. https://stickie.tistory.com/62

  //-------------------------------------------------------------------------
  // 2-4 new. 이제, 합의된 포맷에 따라, 가장 최근에 플레이한 사용자정보만
  //          피니쉬드 유저에 넣으면 되므로.. 인덱싱을 한번만 하기! 2022.01.17

  let theLatestIndex = (intNumOfFinishedUsers-1);

  const intUserDrawType = queryResult[theLatestIndex].drawType; // 0 == draw 그릴 차례, 1 == word 단어를 맞출(쓸) 차례.
    let strUserDrawType; 
    switch( intUserDrawType ){ 
      case 0: 
        strUserDrawType = 'draw';  
        break;
      case 1:
        strUserDrawType = 'word';
        break;
      default:
        const err_msg = "[GivePressureNextUserV2] [Serious Error!!] queryResult[idx].drawType is unknown data: " + intUserDrawType;
        console.log( err_msg );
        return sendRes(402, err_msg);
        break;
    } 

    if( theLatestIndex == 0 ) // 첫번째 플레이어, 즉, 게임을 만든 사람이면,
    {
        // 토스받은 시간이 없으므로, 자신이 게임을 만든시간을 토스 받은 시간으로 생각, 
        // 즉 끝낸시간은 다른사람에게 토스한 시간으로 넣는다. 
        arrayFinishedUsersData.push(
          {
            id: queryResult[theLatestIndex].userUid,
            userIdx: queryResult[theLatestIndex].userIdx,
            nickname: queryResult[theLatestIndex].nickName,
            gender: queryResult[theLatestIndex].gender,
            ageRange: queryResult[theLatestIndex].ageRange, 
            pushToken: queryResult[theLatestIndex].fcmToken,
            country: queryResult[theLatestIndex].currentRegion,
            userLanguage: queryResult[theLatestIndex].userLanguage,
            turnNum: queryResult[theLatestIndex].turnNumber,
            type: strUserDrawType,
            imgUrl: queryResult[theLatestIndex].imageUrl,
            tossTimestamp: dateCreatedTime,
            startTimestamp: null,
            finishTimestamp: queryResult[theLatestIndex].tossedTime
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
            id: queryResult[theLatestIndex].userUid,
            userIdx: queryResult[theLatestIndex].userIdx,
            nickname: queryResult[theLatestIndex].nickName,
            gender: queryResult[theLatestIndex].gender,
            ageRange: queryResult[theLatestIndex].ageRange, 
            pushToken: queryResult[theLatestIndex].fcmToken,
            country: queryResult[theLatestIndex].currentRegion,
            userLanguage: queryResult[theLatestIndex].userLanguage,
            turnNum: queryResult[theLatestIndex].turnNumber,
            type: strUserDrawType,
            imgUrl: queryResult[theLatestIndex].imageUrl,
            tossTimestamp: queryResult[theLatestIndex-1].tossedTime,
            startTimestamp: null,
            finishTimestamp: queryResult[theLatestIndex].tossedTime
          }
        );

    }

    //-------------------------------------------------------------------------
    // 2-5. 게임이 진행중일 경우만, 인덱싱해서 넥스트유저 데이터 만들어야 함. 
    //      맨 마지막 사용자는 별도 처리 필요없겠지? 2021.09.24

    // 이젠 당연히 여기로만 들어가겠지. 2022.01.17
    if( intProgress == CONST_GAME_STATUS__ING ) // 게임이 진행중일 경우만, 인덱싱해서 넥스트유저 데이터 만들어야 함. 
    {
      //-----------------------------------------------------------------------------------
      // 쿼리해서 가져온 데이터 배열 중에서, "마지막 것"의 turnNum을 확인하면, 이것이 현재턴수. 
      // 그리고 다음 사람은, 게임 전체의 다음 사람. 
      //-----------------------------------------------------------------------------------
      
      if( intNumOfFinishedUsers == (theLatestIndex+1) ) // #종료게임용 별도 처리필요!
      {
        // 배열개수에서도 계산할 수 있겠지만, 이게 더 정확히(앱에서의 동작도) 확인하는 것이지.
        // 커런트 턴은, 다음 차례 할 사람의 턴이다! 그래서 + 1.
        intCurrentTurn = queryResult[theLatestIndex].turnNumber + 1; // 게임을 끝낸 최종 사용자의 턴수에, 플러스 1을 한것이 다음 사람의 턴수. 
        intNextUserTurnNum = intCurrentTurn; // 메모리 몇 바이트에 가독성 얻기. 

        // 가장 최근에 끝난 사용자가 다음 사람으로 지정한 그 사람이, 게임 전체의 nextUser.
        // 딜레게이트게임:  이제 이건 이 코드 뒤에서, 받은 사용자로 변경된다!
        //intNextUserIdx = queryResult[theLatestIndex].nextUserIdx;
        intOrigianl_NextUserIdx = queryResult[theLatestIndex].nextUserIdx;

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
            const err_msg = "[GivePressureNextUserV2] [Serious Error!!] queryResult[idx].drawType is unknown data: " + intUserDrawType;
            console.log( err_msg );
            return sendRes(402, err_msg);
            break;
        } 

        // 가장 최근에 끝낸 사용자가 finished 한 시간이 다음 사용자의 toss 타임스탬프. 
        strNextUserTossTimestamp = queryResult[theLatestIndex].tossedTime;

      }  
    }else
    {
      // 딜레게이트 게임에, 진행중이 아닌 게임이 넘어오면 잘못된 거니, 에러를 리스폰스!
      const err_msg = "[GivePressureNextUserV2] [Serious Error!!] It's not a ING game! Check the gameIdx or gameIdx.progress in the requested event!";
      console.log( err_msg );
      return sendRes(402, err_msg);
    }    

    //-------------------------------------------------------------------------   
    // # Next user 의 정보를 넣기! 받은 이벤트로!
    //
    // 쪼르기 게임: 
    // 2022.01.17 이제, 진행중인 경우만 처리되도록. 그 코드만 두기. (이미 위에서 걸렀다) 
    //
    // 2-6. 2021.09.28 넥스트유저 관련 처리가 달라서, 나눠서 작성. 
    // 2-7. 2021.12.10 스코어 카운트 관련 처리가 달라서, 나눠서 넣음.
    //                 종료된 게임은, 레이팅 스코어정보 3종 같이 싣고, 진행중이면 널로 보내기. 
    //                 추후에는 ReportTable도 잘 쿼리서 개수 리얼로 리턴해줘야. 
    //-------------------------------------------------------------------------    
    // 
    let intFunScore=null;
    let intGoldHandScore=null;
    let intReportedCount=null; // 2021.12.10. 임시. 나중에, TossGame 파이널 유저 할 때, 리포트 관련 데이블도 기록한 후에, 쿼리해 오자. 
    // 진행중인 게임의 경우. 드롭이나 에러 경우에는 시작부에서 이미 에러 리스폰스로 걸렀다. 2021.09.28

      //-------------------------------------------------------------------------
      // 딜리게이트게임: 이제는 필요없을듯도 한데, 혹시나 문제있는 데이터 거르기용!
      //
      // 2-8. 예외처리 2차. 쿼리 결과가, currentTurn 과 같지 않다면, 뭔가 잘못된 거니, 
      //      error 를 리스폰스 해야지!!  
      // 물론! 이 경우는 게임이 진행중인 경우를 가정함!
      if( (intNumOfFinishedUsers + 1) != intCurrentTurn ) // 커런트 턴은, 다음 사용자 까지 포함한 턴수 이므로, + 1
      {
        const err_msg = "[GivePressureNextUserV2] [Serious Error!!] The number of the finishedUsers is not equal to the number of rows in DB!!! [GameProgressTable, UserTable]";
        console.log( err_msg );
        return sendRes(402, err_msg);
      }


//-------------------------------------------------------------------------
// 1. 게임 테이블에서, 이 게임의 (아직 하지 않고 있는) 다음 사용자가 누구인지 가져오기. 
//    : GameCurrentTable : KEY는 nextUserIdx, gameIdx
//                       : 한 게임당 한 열. 그 해당게임에 다음 턴인 사람이 누구인지 기록.
//                       : 게임 시작시 1회 insert 되고 그 이후는 update. 게임이 종료되면 delete!!!
//-------------------------------------------------------------------------

//-------------------------------------------------------------------------
// 2. UserTable에서, 아직 안하고 있는 그 사용자의 fcm token 가져오기.
//-------------------------------------------------------------------------

    try{
      // 조인해서 한꺼번에 가져오자. 
      //const queryStr_getFcmTokenForTheVeryNextUser = 'SELECT U.fcmToken '
      // 2022.01.17 추가. JY 요청.
      const queryStr_getFcmTokenForTheVeryNextUser = 'SELECT U.userIdx, U.nickName, U.gender, U.ageRange, U.fcmToken, U.region, U.userLanguage '
                                                          + 'FROM UserTable AS U '
                                                          + 'INNER JOIN GameCurrentTable AS G '
                                                          + 'ON U.userIdx=G.nextUserIdx ' 
                                                          + 'WHERE G.gameIdx=' + intGameIdx +';';

      // 조르기 확인 추가 쿼리문.                                                      

      queryResult = await queryThisFromTheTable(queryStr_getFcmTokenForTheVeryNextUser);

      // 딱 한명이 안나오면, 결과가 없으면 에러를 던지고.
      if( queryResult.length != 1 ) throw ERR_NOT_RCV_JORUGI_OR_NO_USER;

      // 트라이캐치 빠져나가서, 데이터를 담는다. 


    }catch(error)
    {
      let strErrMsg = null;

      if( error == ERR_NOT_RCV_JORUGI_OR_NO_USER )
      {
        //@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
        // TBD. 이경우, 유저테이블은 한번더 쿼리해서 사용자가 
        // 탈퇴 했는지 아닌지 알아내야 한다. 탈퇴 했다면...
        // 시스템이 다른 사람으로 넘겨줘야? 아니면, 새로운 사람을 지정하세요
        // 라고 앱에 알려줘야??
        // 2021.10.28 THU. 20:18
        //@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
        if(queryResult.length == 0)
        {
          strErrMsg = "[GivePressureNextUserV2] [ERROR]: [Invalid user to recieve JORUGI or invalid ING game]: "
                              + "The number of ZERO!: " + queryResult.length + " The user cannot receive JORUGI or the user does not exist." 
                              + " gameIdx: " + event.gameIdx + ", nextUserIdx: Check GameCurrentTable for this gameIdx."
                              + " Or this gameIdx is not currently in-process.";
        }else
        {
          strErrMsg = "[GivePressureNextUserV2] [ERROR]: [Invalid user to recieve JORUGI or invalid ING game]: "
                              + "The number of user(s): " + queryResult.length + " The user cannot receive JORUGI or the user does not exist." 
                              + " gameIdx: " + event.gameIdx + ", nextUserIdx: Check GameCurrentTable for this gameIdx."
                              + " Or this gameIdx is not currently in-process.";
        }

        // 이런 상황. "조르기를 보낼 사용자가 조르기를 받을 수 없어요. "
        console.log(strErrMsg);
        return sendRes(412, strErrMsg);
      }else
      {
        strErrMsg = "[GivePressureNextUserV2] [ERROR] SELECT FAIL. DB Access or etc.:  " + " > " + error; 
        console.log(strErrMsg);
        return sendRes(400, strErrMsg);
      }

    }

    //==============================================================
    // 다음사용자 정보 구성을 위해서, 쿼리 해온 결과를 다음 데이터에 셋.
    //==============================================================
      strNextUserUid = queryResult[0].userUid;
      intNextUserIdx = queryResult[0].userIdx; // 딜레게이트게임 에서는, 넘겨줄 사람 사용자 uid를 얻어오므로 이렇게 해야!

      // intNextUserIdx
      strNextUserNickname = queryResult[0].nickName;
      intNextUserGender = queryResult[0].gender;
      intNextUserAgeRange = queryResult[0].ageRange;
      strNextUserPushToken = queryResult[0].fcmToken;
      strNextUserCountry = queryResult[0].region;
      strNextUserUserLanguage = queryResult[0].userLanguage;    

  //############################################################################################################
  //-------------------------------------------------------------------------
  // 이제 다 끝났나? 2021.09.24, 2022.01.17
  //    : 이제 이건, fcm 메시지의 바디로 보내야 한다. 왜? 받은 사람이 이것만 보고 바로 플레이할 수 있게. 2022.01.19
  //----------------------------------------------------------------------------------------------------
  //############################################################################################################
  const fcm_body = {
    gameInfo: {
      /* dynamo db 버전연동의 json 과 호환을 유지하기 위해 이름을 id로. 자동증가 되는 game의 uid index. unsigned int. */
      /* 2021.11.09. DELETED. id: strGameIdx, */
      id: intGameIdx,
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
      funScore: intFunScore, /* 2021.12.10 */
      goldHandScore: intGoldHandScore, /* 2021.12.10 */
      reportedCount: intReportedCount, /* 2021.12.10 */
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
      tossTimestamp: null,
      startTimestamp: null,
      finishTimestamp: null    
    },
    sys: {
      createdTimestamp: dateCreatedTime, /* 얻어와서 쓰자. 시간. 2021.09.08 */ /* DB에서 비용들여서 가져와? 아님 첫 toss 하면 어차피 붙으니, 첫 toss 하기 전까지 필요없으면 가져오지 말자. */
      endTimestamp: dateEndTime
      },
    timezone: -25200 // TBD.
      };

    // 다음 사람 정보에 넘어가는 타임 스탬프가.. 원래는 이거였는데.. 생각필요. 2022.01.19
    // tossTimestamp: strNextUserTossTimestamp,

    // return sendRes(200, fcm_body); // 임시 테스트, 결과보기용. //2022.01.19 
    // 졸면서 했는데도 잘됩니다, 감사합니다!

//#########################################################################
// [STEP 1] 스텝 원. 끝.
//          뭐가 끝났음? 
//          이벤트로 받은 정보(게임인덱스만)를 사용해서, 현재의 게임 정보를 마치, 
//          TossGameV4에 넘기는 이벤트 json 정보처럼 동일하게 구성. 
//          즉, 게임 기본정보 + 가장 최근에 마친 사람(지금 넘기려는 사람 직전) + 원래 하기로 되어 있는데 아직 안하고 계시는 분.
//          정보로 json 만들기가 끝남!
//#########################################################################

//#########################################################################
// [STEP 2]. 게임 커런트 테이블 업데이트!
//           원래 다음 사용자가 기록되어 있는 게임테이블의 정보를 
//           새로 지정된 다음 사용자 정보로 업데이트 함!
//
// * '조르기' 에서는 할 필요없음. 테이블 정보가 바뀌는 건 없음. 2022.01.21.
//
//#########################################################################

//#########################################################################
// [STEP 3]. 이제, 스텝1에서 구성한 json정보로 TossGame 을 하는데..
//           최근에 JY와 협의된 바에 따라, fcm 메시지에 게임플레이 할수 있는
//           json 정보를 다 실어서 보낸다!
// 
//#########################################################################
try{

  const pushResult = await sendPush_v04(fcm_body, strNextUserPushToken);

  console.logDebug("[GivePressureNextUserV2] DEBUG_MSG.  ### PUSH OK ###. " + "gameIdx: " + intGameIdx + ", nextUserIdx: " + intNextUserIdx
                                                        + ": fcm push response: " + JSON.stringify(pushResult) );
  
  // 트라이 캐치 빠져나가서 리스폰스. 

}catch(error)
{
  const err_msg = "[GivePressureNextUserV2] [Error] FCM Push FAIL for a delegating:  " 
                      + "gameIdx: " + intGameIdx
                      + ", the next user index: " + intNextUserIdx
                      + " > " + error;
  console.log(err_msg);

  return sendRes(420, error);
}

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

//#########################################################################
// [STEP 4]. 자, 이제 다 했으면, 리스폰스를 간략히보낸다. 
//#########################################################################
const return_body = {
  gameIdx: intGameIdx,
  nextUserIdx: intNextUserIdx,
  nextUserNickname: strNextUserNickname,
  msg: 'It has been given pressure to this user. FCM sending is successful.'
};
return sendRes(200, return_body);



  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // return { message: 'Go Serverless v1.0! Your function executed successfully!', event };
};