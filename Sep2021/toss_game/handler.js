//-------------------------------------------------------------------------------------
// Project: SketchBird
// DB: mysql.
// 
// 게임을 토스할 떄 쓰는 람다.
//
// 
// 2021.08.30. sjjo. Oh, MLJPHM PHMICFY Oh, LGMYW
// 2021.09.02. sjjo. JS와 협의. 
              /*
              gameInfo.id : string 으로 변환

              gameInfo.progress 숫자로. 

              gameType : 0 or 1 
              type 기존대로.

              */
// 2021.09.09. sjjo. JS와 협의. 
//            .country 는 user region 집어넣기. 
//            .lang 추가. 
//            @@ 앱단과 논의 @@  : 전부 clear.
//            request JSON 에 추가한 필드 2개. 추가 위치 3군데.
/*
              // language code  ref. https://html-shark.com/HTML/LanguageCodes.htm
              gameInfo.keywordLanguage : "ko" or "en" "zh"... 
              gameInfo.finishedUsers[0].userLanguage : "ko" or "en" "cn"... 
              gameInfo.nextUser.userLanguage : "ko" or "en" "cn"... 
*/
// 2021.09.27. sjjo. 
//            1. JS와 협의 & 게임 끝난 경우의 처리 시작.
//            2. 코드정리. sendPush_v02 삭제. 필요하면 Aug2021 폴더 봐라.
//               
//
// 
//
//-------------------------------------------------------------------------------------

'use strict';

const mysql = require('mysql');

// 스케치버드 app auth. 
const authHeader = 'key=AAAAV4RN8sw:APA91bHXNh3Xks6o1bZMlabRX52TFTeuT1CUlmHCmPKs-smY3Xgtn2mYClXi0netKd4LZ2ThSLF9Y9vAvOQdFM-5HVNMZdjQ9V3RuAFJ-hAVoJ2ICb1Mn79TdNCfwrTkQhzRsOBupnfa';

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

    //var strQueryString = 'SELECT subject FROM posts ORDER BY RAND() LIMIT ' + nNumOfRandomWords.toString();

    mysql_connection.query(query_string, function(err, result, field) {
        if(result)
          resolve(result);
        
        if(err)
          console.log("[TossGame] [ERROR]: db-error:",err);
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



//===========================================================================
// FCM 날리는 부. Ver. 03. 2021.09.13
// fcm 날릴 때, 데이터 부분에, 기존 JSON 전체 대신에, gameUid 만 실어보내는 방식.
// 거기에, return도 성공시, 보낸 userUid string 만. 
//===========================================================================
function sendPush_v03(event, token) {

  const https = require('https');
  
  /* 얼마 안되도, 메모리 쓸필요 없지. 걍 바로. 
  // 2021.01.29
  const deviceToken = token; //event.nextUser.pushToken;
  const title = event.nextUser.id;
  const body = event.nextUser.type;
  
  // 2021.04.27. Image 필드 추가. JS 요청.
  const imageurl = event.finishedUsers[(event.gameInfo.currentTurn-2)].imgUrl; // TURN_INDEX_20210527
  

  // 2021.05.04.
  const gameUid = event.gameInfo.id;
  */

  // 진행중 게임용으로 다시 살림. 2021.09.28
  // 나중에 gameInfo에 언어코드 읽어서, 언어별로 해주면 되지. 
  const inggame_title = "SketchBird: 짹짹!!";
  const inggame_body = event.finishedUsers[(event.gameInfo.currentTurn-2)].nickname + " 에게서 그림쪽지가 도착했어요!";  
 

  const reqMiniBody = '{"to":"' + token +'",' +
                  '"priority" : "high",' +
                  '"notification" : {' +
                    '"title": "' + inggame_title +'",'+ 
                    '"image": "' + event.finishedUsers[(event.gameInfo.currentTurn-2)].imgUrl +'",'+
                    '"click_action" : "FLUTTER_NOTIFICATION_CLICK",'+ 
                    '"body": "' + inggame_body + '"'+
                  '},' +
                  '"data" : {'+
                      '"click_action" : "FLUTTER_NOTIFICATION_CLICK",'+
                      '"screen" : "/game/receive", '+
                      '"json": "' + event.gameInfo.id +'"' +
                    '}'+
                  '}';

  // 결과만 딱 보내기. 2021.09.13.
  /*
  const responseData = '{"id": "' + event.nextUser.id +'",' + 
                      '"msg" : "FCM Sending is successed."' +
                      '}';
                      */
  /* 
  const responseData = JSON.stringify(
                                      {
                                        id: + event.nextUser.id,
                                        msg: 'FCM Sending is succeeded.'
                                      }, null, 2 
                                      );           
  */                                      
                                      
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
          console.log('[@Toss Game@] :( [FCM Sending] failure' + e.message);
          reject(e.message);
      });
      
              
      // 쓸데없는 log 는 빼자. console.log(reqMiniBody);

      req.write(reqMiniBody);
      req.end();
  });
      
}

//===========================================================================
// FCM 날리는 부. Ver. 03의 게임 종료시 push날리기 용. 2021.09.28
// 왜? 
//   이경우, 여러사용자에게 fcm 날리므로, 앱측에 리스폰스를 제대로 날려주기 위해. 
// 
// fcm 날릴 때, 데이터 부분에, 기존 JSON 전체 대신에, gameUid 만 실어보내는 방식.
// 거기에, return도 성공시, 보낸 userUid string 만. 
//===========================================================================
function sendPush_v03_forEndGame(event, token) {

  const https = require('https');
  
  /* 얼마 안되도, 메모리 쓸필요 없지. 걍 바로. 
  // 2021.01.29
  const deviceToken = token; //event.nextUser.pushToken;
  const title = event.nextUser.id;
  const body = event.nextUser.type;
  
  // 2021.04.27. Image 필드 추가. JS 요청.
  const imageurl = event.finishedUsers[(event.gameInfo.currentTurn-2)].imgUrl; // TURN_INDEX_20210527
  

  // 2021.05.04.
  const gameUid = event.gameInfo.id;
  */
  
  // 끝난 게임용으로 다시 살림. 2021.09.28
  // 나중에 gameInfo에 언어코드 읽어서, 언어별로 해주면 되지. 
  const endgame_title = "SketchBird: 짹짹!!";
  const endgame_body = event.gameInfo.maximumTurn + "턴 짜리 그림이 완성되었어요!";
  const endgame_image = "https://sjtest0204-upload.s3.ap-northeast-2.amazonaws.com/sb_endgame_img.png";

  const reqMiniBody = '{"to":"' + token +'",' +
                  '"priority" : "high",' +
                  '"notification" : {' +
                    '"title": "' + endgame_title +'",'+  /* 바꾸기. 끝났어요.  */
                    '"image": "' + endgame_image +'",'+
                    '"click_action" : "FLUTTER_NOTIFICATION_CLICK",'+ 
                    '"body": "' + endgame_body + '"'+ 
                  '},' +
                  '"data" : {'+
                      '"click_action" : "FLUTTER_NOTIFICATION_CLICK",'+
                      '"screen" : "/game/receive", '+
                      '"json": "' + event.gameInfo.id +'"' +
                    '}'+
                  '}';

  // 결과만 딱 보내기. 2021.09.13.
  /*
  const responseData = '{"id": "' + event.nextUser.id +'",' + 
                      '"msg" : "FCM Sending is successed."' +
                      '}';
                      */
  /* 
  const responseData = JSON.stringify(
                                      {
                                        id: + event.nextUser.id,
                                        msg: 'FCM Sending is succeeded.'
                                      }, null, 2 
                                      );           
  */                                      
                                      
  // 역슬래시 문제 해결 위해. 2021.09.14 rendRes 할때 스트링기파이 같이 한다, local 에서만. 
  //    remote는 안하고 붙여야 역슬래시 안생긴다.
  const responseData = {
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
          console.log('[@Toss Game@] :( [FCM Sending] failure' + e.message);
          reject(e.message);
      });
      
              
      // 쓸데없는 log 는 빼자. console.log(reqMiniBody);

      req.write(reqMiniBody);
      req.end();
  });
      
  }

module.exports.TossGame = async (event) => {


//#########################################################################
//=========================================================================
// A. 받은 json에서 기본적으로 필요한 정보를 분류한다. 
//    가독성 위해서.
//    ~~왜? 이 json 포맷은 내가 테스트 할때와 실제 정해질 것이 다를 것이기 때문.~~
//=========================================================================
//#########################################################################

  // 뎁스 var title = event.nextUser.id;
  let TABLE_NAME; 
  let queryResult = null; // 반복사용?

  //---------------------------------------
  // 2021.09.08.  지우지 말것! (나중을 위해)
  // String 으로 넘어온 Game Idx 즉 gameInfo.id 를, db 에 넣기 위해 int로 변환.
  // 이거, 숫자길이의 한계를 고려하거나, 실행시간을 고려하면 간단한 문제는 아니다. 
  // 일단 이 레퍼를 주요하게 참조. 실행시간 등. https://flaviocopes.com/how-to-convert-string-to-number-javascript/
  /* parseInt("7178912437093423423");
     7178912437093423000
     Number("7178912437093423423")
     7178912437093423000
     Math.floor('7178912437093423423');
     7178912437093423000
     "7178912437093423423"*1
     7178912437093423000
     가장 실행시간 빠르다는 mul 방법으로. 
  */
  const strGameIdx = event.gameInfo.id; 
  const intGameIdx = strGameIdx * 1; 
  
  const intMaxTurn = event.gameInfo.maximumTurn; // 위치 옮김. 2021.09.27

  let intProgressIdx = null; // GameProgressTable 에 인서트 하고, 얻어올 인덱스 값. 위치 옮김. 2021.09.27


  
  let intGameStatus; // 0==일단만들어짐(첫토스이전), 1==진행중, 2==완료, 3==드롭, 4==뭔가 문제? assign 바꿀려면, CreateGame쪽 코드도 같이 바꿔야.
  //이제는 이값이 int. 2021.09.08.
  intGameStatus = event.gameInfo.progress; // BUG_FIX. 2021.09.23. 2번째 모의 턴을 돌려보다가. 



//#########################################################################
//=========================================================================
// B. 게임이 진행중 일 경우. 
//    * nextUser 의 정보를 구한다. 
//       테이블: UserTable.
//    * finishedUsers 에 있는 사용자들만 insert , upsert 한다. 
//       테이블: GameTable, GameProgressTable, GameCurrentTable, GameHistoryTable.
//    * 다음 사용자에게, 현재의 게임인덱스로 push를 날린다.  
//=========================================================================
//#########################################################################
if( intGameStatus < CONST_GAME_STATUS__END ) // 0==일단만들어짐(첫토스이전), 1==진행중, 2==완료, 3==드롭, 4==뭔가 문제? assign 바꿀려면, CreateGame쪽 코드도 같이 바꿔야.
{
  // 게임이 진행중일 경우만, 다음사용자의 데이터가 있다!
  const strNextUserUid = event.nextUser.id;

  //=========================================================================
  // 0. 최초 토스 인 경우 && 게임이 진행중 일 경우. 
  //     : 이 경우에만, GameTable의 status를 0에서 1로 바꿔줘야 한다. 
  //              
  //=========================================================================      
  if( intGameStatus == CONST_GAME_STATUS__START ) //if( event.gameInfo.progress == 0 ) //이제는 이값이 int. 2021.09.08.
  {
      // CreateGame 이후, 만든 사람이 처음 토스를 넘긴(TossGame 을 호출한) 경우, 상태를 0에서 1로 바꾼다. 
      intGameStatus = CONST_GAME_STATUS__ING;

      try{
        TABLE_NAME = 'GameTable';

        const query_updateGameTable = 'UPDATE ' + TABLE_NAME + ' '
                                            + 'SET '
                                            + 'status=' +  intGameStatus
                                            + ' '
                                            + 'WHERE gameIdx=' + intGameIdx + ';';

        queryResult= await queryThisFromTheTable(query_updateGameTable);


      }catch(error)
      {
        console.log("[TossGame] [Error] [GameTable] game status UPDATE FAIL. DB Access or etc.:  " + " > " + error);
        return sendRes(400, error);
      }

  }
  // 예외처리 할 경우. return sendRes(410, "Game JSON data error! Field: gameInfo.progress ");

  //-------------------------------------
  // 기존 ddb JSON 들과 호환을 유지하기 위한 text <-> int 매핑.   
  const strDrawType = event.finishedUsers[(event.gameInfo.currentTurn-2)].type;
  let intDrawType; // 0 == draw 그릴 차례, 1 == word 단어를 맞출(쓸) 차례.
  switch( strDrawType ){ 
    case "draw": 
      intDrawType = 0;  
      break;
    case "word":
      intDrawType = 1;
      break;
    default:
      return sendRes(410, "Game JSON data error! Field: gameInfo.finishedUsers[#].type : draw or word type.");
      break;
  }  


  
  //@@@@ 확인하는 조건문 필요!! @@@@

  //-------------------------------------------------------------------------
  // 1. DB에서 다음 플레이어의 fcm token 가져오기 : UserTable
  //    : 받은 UserIdx로 FcmToken 가져오기. 
  //-------------------------------------------------------------------------
  try{

    //const query_getUserInfo = 'SELECT userIdx, fcmToken FROM UserTable WHERE userUid=\'' + sNextUserUid + '\' ;';
    // 다음 플레이어 정보를 가져올 수 있는건 다 가져와야. 
    TABLE_NAME = 'UserTable';
    //const query_getUserInfo = 'SELECT userIdx, fcmToken, nickName, ageRange, gender, region FROM ' + TABLE_NAME + ' WHERE userUid=\'' + strNextUserUid + '\' ;';
    const query_getUserInfo = 'SELECT userIdx, fcmToken FROM ' + TABLE_NAME + ' WHERE userUid=\'' + strNextUserUid + '\' ;';
    //console.log(query_getUserInfo);

    queryResult= await queryThisFromTheTable(query_getUserInfo);

    //return sendRes(200, resultUserInfo);

  }catch(error)
  {
    console.log("[TossGame] [Error] [UserTable] SELECT FAIL. DB Access or etc.:  " + " > " + error);
    return sendRes(400, error);
  }

  // 예외처리. 2021.09.24
  if(queryResult.length == 0) 
  {
    const err_msg = "[TossGame] [Error] [UserTable] There is NO such a user!";
    console.log(err_msg);
    return sendRes(402, err_msg);
  }
  if(queryResult.length > 1 )
  {
    const err_msg = "[TossGame] [Error] [UserTable] There are more than ONE user!";
    console.log(err_msg);
    return sendRes(402, err_msg);
  }


  const intNextUserIdx = queryResult[0].userIdx;
  const strNextUserFcmToken = queryResult[0].fcmToken;
  /* 언제 어떻게 사용하지? 현재로서는, toss game 이 성공실패만 리턴하는데. 
  const strNickName = queryResult[0].nickName;
  const intAgeRange = queryResult[0].ageRange;  
  const intGender = queryResult[0].gender;
  const strRegion = queryResult[0].region;*/
  //console.log(queryResult[0].UserIdx);
  //console.log(queryResult[0].FcmToken);


  
  //-------------------------------------------------------------------------
  // 2. DB에 진행 상황을 기록하기 : GameProgressTable : KEY는 gameIdx, PK는 gameIdx, progressIdx
  //                             : 한게임*턴수 만큼 열이 생김. (GameIdx 가 partition). 턴이 넘어갈 때마다 insert 가 됨.  
  //    그리든, 쓰든, "완료한 사람" 에 해당해서만 기록.  @@ 앱단과 논의 @@ +OK주석. 
  //-------------------------------------------------------------------------
  //---------------------------------------
  // -2 인 이유에 대해서는, 
  // handover_toss_chain_07.js 의 2021.05.27 주석을 참조.
  // 여기서는 사용 안하므로 주석처리. const strUserUid = event.finishedUsers[(event.gameInfo.currentTurn-2)].id; // 둘이 헛갈리지 마셈.
  // ### 앱단에서 추가해달라고 해야한다. 그래야 progressTable에 바로 넣을 수 있다. 
  const intUserIdx = event.finishedUsers[(event.gameInfo.currentTurn-2)].userIdx; // 둘이 헛갈리지 마셈.
  const strImageUrl = event.finishedUsers[(event.gameInfo.currentTurn-2)].imgUrl;


  //------------------------------------- @@ 앱단과 논의 @@ +OK주석.
  // 다음사람이(nextUser) 할 턴의 회차. 지금 막 완료한 사용자의 턴수? 토스 받은 사람이 할 턴수?
  // 그러니까, 첫 만든 사람이 그리면 1이고, create_game 이후에, toss_game이 [처음] 호출되면 바로 2가 된 상태로 온다.
  const intTurnNumber = event.finishedUsers[(event.gameInfo.currentTurn-2)].turnNum; // 지금 그린 사람의 턴수. 1 부터 시작.  

  // 지역도 있어야지. 가장 최근에 끝낸 사람의 지역.  @@ 앱단과 논의 @@ +OK주석.
  const strCurrentRegion = event.finishedUsers[(event.gameInfo.currentTurn-2)].country;
    

  try{

    // 이 테이블은 한게임당 게임의 턴수 만큼 insert. 계속 유지. 
    TABLE_NAME = 'GameProgressTable';
    const query_insertGameProgress = 'INSERT INTO ' + TABLE_NAME +' '
                                        + '('
                                        + 'gameIdx'
                                        + ', imageUrl'
                                        + ', maxTurn'
                                        + ', nextUserIdx' /* 턴을 받을 사람 */
                                        + ', status'
                                        + ', tossedTime'
                                        + ', turnNumber'
                                        + ', drawType'
                                        + ', userIdx' /* 턴을 넘긴 사람 */
                                        + ', currentRegion'
                                        + ') ' 
                                        
                                        + 'VALUES ('
                                        +  intGameIdx
                                        + ', \'' + strImageUrl + '\''
                                        + ', ' + intMaxTurn
                                        + ', ' + intNextUserIdx
                                        + ', ' + intGameStatus
                                        + ', Now()' /* 토스한 시간. FCM 날리기전이므로 좀 애매하긴 하지만, 그래도 db에 기록을 '성공'하고나서 FCM 날려야 받은 사람이 읽을 데이터가 있지. */
                                        + ', ' + intTurnNumber
                                        + ', ' + intDrawType
                                        + ', ' + intUserIdx
                                        + ', \'' + strCurrentRegion + '\''
                                        +');';

    queryResult= await queryThisFromTheTable(query_insertGameProgress);

    intProgressIdx = queryResult.insertId; // 방금 인서트한 프로그래스 id를 저장하고,

    //return sendRes(200, resultUserInfo);

  }catch(error)
  {
    console.log("[TossGame] [Error] [GameProgressTable] INSERT FAIL. 1 of 2. DB Access or etc.:  " + " > " + error);
    console.log("[TossGame] [Error] [GameProgressTable] INSERT FAIL. 2 0f 2. gameIdx:  " + strGameIdx + " integered gameIdx: " + intGameIdx.toString() ); // 혹시모르니, gameIdx를 확인하자. str int 모두.
    return sendRes(400, error);
  }


  //-------------------------------------------------------------------------
  // 3. DB에 현재 상태를 기록하기 : GameCurrentTable : KEY는 nextUserIdx, gameIdx
  //                             : 한 게임당 한 열. 그 해당게임에 다음 턴인 사람이 누구인지 기록.
  //                               게임 시작시 1회 insert 되고 그 이후는 update. 게임이 종료되면 delete!!!
  //    이제 해야할 차례만 기록. 
  //    # 내 입장에서 해야할 게임들을 쿼리 할 때 # 사용하기 위해. @@ 앱단과 논의 @@ +OK주석.
  //-------------------------------------------------------------------------
  //console.log("progressIdx : " + intProgressIdx);
  const intNextUserTurnNumber = event.gameInfo.currentTurn; // next user 가 할 회차는, 앱단에서 여기에 넣어준다. 첫 토스 부터 2. @@ 앱단과 논의 @@  +OK주석. 
  const strNextUserDrawType = event.nextUser.type;
  let intNextUserDrawType; // 0 == draw 그릴 차례, 1 == word 단어를 맞출(쓸) 차례.
  switch( strNextUserDrawType ){ 
    case "draw": 
      intNextUserDrawType = 0;  
      break;
    case "word":
      intNextUserDrawType = 1;
      break;
    default:
      return sendRes(410, "Game JSON data error! Field: gameInfo.finishedUsers[#].type ");
      break;
  } 
  
  // Ref. https://bamdule.tistory.com/112  
  try{
    TABLE_NAME = 'GameCurrentTable';
    // 이 테이블은, 한게임당 1열. 처음엔 insert, 후에는 update, 게임 finish 될 때 delete.
    const query_upsertGameCurrent = 'INSERT INTO ' + TABLE_NAME + ' '
                                        + '('
                                        + 'gameIdx' /* 이게 이 테이블의 PK. 턴을 받을 사람 */
                                        + ', nextUserIdx'
                                        + ', progressIdx'
                                        + ', maxTurn' 
                                        + ', prevImgUrl'
                                        + ', turnNumber'
                                        + ', drawType'
                                        + ') ' 
                                        
                                        + 'VALUES ('
                                        +  intGameIdx
                                        + ', ' + intNextUserIdx
                                        + ', ' + intProgressIdx
                                        + ', ' + intMaxTurn
                                        + ', \'' + strImageUrl + '\''
                                        + ', ' + intNextUserTurnNumber
                                        + ', ' + intNextUserDrawType 
                                        +') '

                                        + 'ON DUPLICATE KEY UPDATE '
                                        /* 2번째 턴부터, 이 값이 업데이트 되어야지. 기존 행에. BUG_FIX 2번째 모의 턴 테스트중. 2021.09.23 */
                                        + 'nextUserIdx=' + intNextUserIdx
                                        + ', progressIdx=' + intProgressIdx
                                        + ', maxTurn=' + intMaxTurn
                                        + ', prevImgUrl=' +'\'' + strImageUrl + '\''
                                        + ', turnNumber=' + intNextUserTurnNumber 
                                        + ', drawType=' + intNextUserDrawType 
                                        + ';';

    queryResult= await queryThisFromTheTable(query_upsertGameCurrent);

    //return sendRes(200, resultUserInfo);

  }catch(error)
  {
    console.log("[TossGame] [Error] [GameCurrentTable] INSERT or UPDATE FAIL. DB Access or etc.:  " + " > " + error);
    return sendRes(400, error);
  }

  //-------------------------------------------------------------------------
  // 4. DB에 진행 이력을 기록하기 : GameHistoryTable : KEY는 userIdx
  //                             : 게임수(한게임)*참여사용자수. 본인이 참여 완료한 게임이 무엇인지 기록. 
  //                               턴이 넘어갈 때마다 insert or update 
  //                               (참여 플레이어가 중복되면 update, 참여 플레이어가 new 이면 insert)
  //
  //    쓰든, 그리든, 참여 완료! 한 사람 만 기록.
  //    참여 완료한 (끝났든 아니든) 게임을 기록하기 위해.
  //    # 내 입장에서 내가 참여 완료한 게임들을 쿼리# 할 때 사용하기 위해. 
  //-------------------------------------------------------------------------

  try{
    TABLE_NAME = 'GameHistoryTable';
    // 이 테이블은, 한게임*참여사용자수 만큼 열이 생겨야. 새로운 참여사용자는 insert, 중복되는 참여사용자는 update, 게임 finish 되어도 계속 유지.
    const query_upsertGameHistory = 'INSERT INTO ' + TABLE_NAME + ' '
                                        + '('
                                        + 'userIdx' /* ~~ 이게 이 테이블의 PK. 이 게임에서, 가장 최근에 턴을 완료한 사람 ~~ */
                                        + ', gameIdx' /* 유져인덱스와 게임인덱스의 조합이 Unique Key. 9월 중순쯤 JY+SJ 가 변경. 2021.09.23 */
                                        + ', progressIdx'
                                        + ') ' 
                                        
                                        + 'VALUES ('
                                        +  intUserIdx /* STEP 2 에서 넣은, 가장최근에 finishedGame 한 유저의 Idx */
                                        + ', ' + intGameIdx
                                        + ', ' + intProgressIdx /* STEP 2의 결과로 나온, 완료한 이번 턴에 대한 progressIdx */
                                        +') '

                                        + 'ON DUPLICATE KEY UPDATE ' /* 이것도, 한 게임 내에서 중복된 사용자의 경우, 프로그래스인덱스만 업데이트 해야함. 2021.09.23 */
                                        // + 'gameIdx=' + intGameIdx
                                        + 'progressIdx=' + intProgressIdx
                                        + ';';

    queryResult= await queryThisFromTheTable(query_upsertGameHistory);

    //return sendRes(200, resultUserInfo);

  }catch(error)
  {
    console.log("[TossGame] [Error] [GameHistoryTable] INSERT or UPDATE FAIL. DB Access or etc.:  " + " > " + error);
    return sendRes(400, error);
  }
  
  // 게임 히스토리 테이블 업서트 하고 나면 뭐해야 하지? 일단 FCM 날리기로 가보자. 2021.09.13
  


  //-------------------------------------------------------------------------
  // 5. 다음 플레이어에게 FCM 토큰을 날리기. : 현재의 gameIdx 만.
  //    
  //-------------------------------------------------------------------------

  
  try{
    //var pushResultJson = await sendPush(event, userToken);
    //const pushResultJson = await sendPush_v02(event, strNextUserFcmToken); // 2021.05.04. 5월달에 했던걸 지금 또 새로 사용.. 2021.09.13
    const pushResult = await sendPush_v03(event, strNextUserFcmToken); // 하지말고, v03으로 수정 시도. 왜? json 리스폰스 할 필요도 없고, 성공 실패만. 
    
    
    //console.log("###### ing : createdUserId: " + event.gameInfo.createdUserId + ", createdTime: " + event.gameInfo.createdTime);
    //console.log("@@@@ ING. Push OK.  1/2: curr: " + event.gameInfo.currentTurn + " maxturn: " + event.gameInfo.maximumTurn + " Keyword: " + event.gameInfo.keyword); // 2021.05.22.
    //console.log("@@@@ ING. Push OK.  2/2 : userToekn: " + strNextUserFcmToken + " PushResult: " + pushResultJson);

    return sendRes(200, pushResult);
    
    
    } catch(error) 
    {
      console.log( "[TossGame] [Error] ING. FCM Push FAIL!! " + error + ", FaildUserUid(nextUser): " + strNextUserUid);
      return sendRes(420, error);
    }
} // END of B. 게임이 진행중일 경우의 처리.    
else if( intGameStatus == CONST_GAME_STATUS__END ) 
{
//#########################################################################
//=========================================================================
// C. 게임이 끝났을 경우: 마지막 플레이어가 완료해서, 제이슨이 넘어을 경우. 
//=========================================================================
//#########################################################################

  //-------------------------------------------------------------------------
  // 1. 참여했던 사용자들의 FCM 토큰 가져오기. 
  //    : Request로 온 제이슨에 있는, 각 사용자의 FCM토큰을 믿고 그대로 읽어서 사용한다. 
  //    왜? 이 request가 오기 '직전'에, 앱단에서 GetGameInfo를 통해 제이슨 구성했을 것이고, 
  //        GetGameInfo 할때, UserTable 쿼리해서 FCM토큰 받아올 것이기 때문. 
  //-------------------------------------------------------------------------
  // 리퀘스트 event 데이터 그대로 사용. 

  //-------------------------------------------------------------------------
  // 2. DB에 마지막 플레이어의 플레이 정보 전체를 기록하기 : GameProgressTable 
  //    : PK는 gameIdx, progressIdx, KEY는 gameIdx.
  //    : 한게임*턴수 만큼 열이 생김. (GameIdx 가 partition). 턴이 넘어갈 때마다 insert 가 됨.  
  //    그리든, 쓰든, "완료한 사람" 에 해당해서만 기록.  @@ 앱단과 논의 @@ +OK주석. 
  //-------------------------------------------------------------------------
  const intFinal_UserIdx = event.finishedUsers[(event.gameInfo.maximumTurn-1)].userIdx; 
  const strFinal_ImageUrl = event.finishedUsers[(event.gameInfo.maximumTurn-1)].imgUrl;
  const intFinal_TurnNumber = event.finishedUsers[(event.gameInfo.maximumTurn-1)].turnNum; 
  const strFinal_CurrentRegion = event.finishedUsers[(event.gameInfo.maximumTurn-1)].country;

  //-------------------------------------
  // 기존 ddb JSON 들과 호환을 유지하기 위한 text <-> int 매핑.   
  const strFinal_DrawType = event.finishedUsers[(event.gameInfo.maximumTurn-1)].type;
  let intFinal_DrawType; // 0 == draw 그릴 차례, 1 == word 단어를 맞출(쓸) 차례.
  switch( strFinal_DrawType ){ 
    case "draw": 
      intFinal_DrawType = 0;  
      break;
    case "word":
      intFinal_DrawType = 1;
      break;
    default:
      return sendRes(410, "Game JSON data error! Field: gameInfo.finishedUsers[#].type : draw or word type.");
      break;
  }    

  // 2021.09.27 18:43 일단 여기서 오늘은 마무리. 내일 맑은 머리에서 찬찬히 해보자. 
  // 2021.09.28 10:33 다시시작. 
  try{

    // 마지막 사용자를 기록. 이 테이블은 한게임당 게임의 턴수 만큼 insert. 계속 유지. 
    // 마지막 사용자 이므로, nextUser 관련된 정보가 없다. 
    TABLE_NAME = 'GameProgressTable';
    const query_insertFinal_GameProgress = 'INSERT INTO ' + TABLE_NAME +' '
                                        + '('
                                        + 'gameIdx'
                                        + ', imageUrl'
                                        + ', maxTurn'
                                        + ', nextUserIdx' /* 턴을 받을 사람 */
                                        + ', status'
                                        + ', tossedTime'
                                        + ', turnNumber'
                                        + ', drawType'
                                        + ', userIdx' /* 턴을 넘긴 사람 */
                                        + ', currentRegion'
                                        + ') ' 
                                        
                                        + 'VALUES ('
                                        +  intGameIdx
                                        + ', \'' + strFinal_ImageUrl + '\''
                                        + ', ' + intMaxTurn
                                        + ', ' + null /* 마지막 플레이어가 토스한 상황이므로, 다음사용자는 null */
                                        + ', ' + intGameStatus
                                        + ', Now()' /* 마지막 플레이어가 그리고, 토스게임 호출한 시간, 즉 게임 전체가 끝난시간.  */
                                        + ', ' + intFinal_TurnNumber
                                        + ', ' + intFinal_DrawType
                                        + ', ' + intFinal_UserIdx
                                        + ', \'' + strFinal_CurrentRegion + '\''
                                        +');';

    queryResult= await queryThisFromTheTable(query_insertFinal_GameProgress);

    intProgressIdx = queryResult.insertId; // 방금 인서트한 프로그래스 id를 저장하고,


  }catch(error)
  {
    console.log("[TossGame] [Error] [GameProgressTable] The final user. INSERT FAIL. 1 of 3. DB Access or etc.:  " + " > " + error);
    console.log("[TossGame] [Error] [GameProgressTable] The final user. INSERT FAIL. 2 of 3. gameIdx:  " + strGameIdx + " integered gameIdx: " + intGameIdx.toString() ); // 혹시모르니, gameIdx를 확인하자. str int 모두.
    console.log("[TossGame] [Error] [GameProgressTable] The final user. INSERT FAIL. 3 of 3. The final userIdx:  " + intFinal_UserIdx ); 
    return sendRes(400, error);
  }

  //-------------------------------------------------------------------------

  //-------------------------------------------------------------------------
  // 3. DB에 마지막 플레이어의 진행 이력을 기록하기 : GameHistoryTable 
  //     : UNIQUE KEY는 userIdx + gameIdx 조합.
  //     : 게임수(한게임)*참여사용자수. 본인이 참여 완료한 게임이 무엇인지 기록. 
  //       턴이 넘어갈 때마다 insert or update 
  //       (참여 플레이어가 중복되면 update, 참여 플레이어가 new 이면 insert)
  //
  //    쓰든, 그리든, 참여 완료! 한 사람 만 기록.
  //    참여 완료한 (끝났든 아니든) 게임을 기록하기 위해.
  //    # 내 입장에서 내가 참여 완료한 게임들을 쿼리# 할 때 사용하기 위해. 
  // 
  //   * 이 게임이 끝났는지, 어디까지 진행중인지 알려면, 
  //     이 테이블에 있는 progressIdx or gameIdx로 GameProgressTable을 조회해 뵈야 안다. 2021.09.27
  //-------------------------------------------------------------------------
  try{
    TABLE_NAME = 'GameHistoryTable';
    // 이 테이블은, 한게임*참여사용자수 만큼 열이 생겨야. 새로운 참여사용자는 insert, 중복되는 참여사용자는 update, 게임 finish 되어도 계속 유지.
    const query_upsertFinal_GameHistory = 'INSERT INTO ' + TABLE_NAME + ' '
                                        + '('
                                        + 'userIdx' /* ~~ 이게 이 테이블의 PK. 이 게임에서, 가장 최근에 턴을 완료한 사람 ~~ */
                                        + ', gameIdx' /* 유져인덱스와 게임인덱스의 조합이 Unique Key. 9월 중순쯤 JY+SJ 가 변경. 2021.09.23 */
                                        + ', progressIdx'
                                        + ') ' 
                                        
                                        + 'VALUES ('
                                        +  intFinal_UserIdx /* 최종 플레이한 유저의 Idx */
                                        + ', ' + intGameIdx
                                        + ', ' + intProgressIdx /* STEP 2의 결과로 나온, 완료한 이번 턴에 대한 progressIdx */
                                        +') '

                                        + 'ON DUPLICATE KEY UPDATE ' /* 이것도, 한 게임 내에서 중복된 사용자의 경우, 프로그래스인덱스만 업데이트 해야함. 2021.09.23 */
                                        // + 'gameIdx=' + intGameIdx
                                        + 'progressIdx=' + intProgressIdx
                                        + ';';

    queryResult= await queryThisFromTheTable(query_upsertFinal_GameHistory);

    //return sendRes(200, resultUserInfo);

  }catch(error)
  {
    console.log("[TossGame] [Error] [GameHistoryTable] The final user. INSERT or UPDATE FAIL. 1 of 2. DB Access or etc.:  " + " > " + error);
    console.log("[TossGame] [Error] [GameHistoryTable] The final user. INSERT or UPDATE FAIL. 2 of 2. The final userIdx:  " + intFinal_UserIdx + ", gameIdx: " + intGameIdx); 
    return sendRes(400, error);
  }  
  //-------------------------------------------------------------------------
  
  //-------------------------------------------------------------------------
  // 4. 현재 진행중임을 나타내는 DB에 이 끝난 게임 정보를 지우기 : GameCurrentTable 
  //     : PK는 gameIdx, KEY는 nextUserIdx
  //     : 한 게임당 한 열. 그 해당게임에 다음 턴인 사람이 누구인지 기록.
  //     : 게임 시작시 1회 insert 되고 그 이후는 update. 게임이 종료되면 delete!!!
  //    이제 해야할 차례만 기록. 
  //    # 내 입장에서 해야할 게임들을 쿼리 할 때 # 사용하기 위해. @@ 앱단과 논의 @@ +OK주석.
  //-------------------------------------------------------------------------
  // 프로그래스 테이블, 히스토리 테이블 모두 다 데이터 쓰기 성공했다면, 
  // 이제 진행중 정보를 기록했던 이것을 지우면 되고, 
  // 이것까지 성공해야, 게임이 끝났다고 기록할 수 있다. 

  try{
    TABLE_NAME = 'GameCurrentTable';

    const query_deleteFinal_GameCurrent = 'DELETE FROM ' + TABLE_NAME + ' ' + 'WHERE gameIdx=' + intGameIdx + ';';

    queryResult = await queryThisFromTheTable(query_deleteFinal_GameCurrent);

  }catch(error){
    console.log("[TossGame] [Error] [GameCurrentTable] The final user. DELETE FAIL. 1 of 2. DB Access or etc.:  " + " > " + error);
    console.log("[TossGame] [Error] [GameCurrentTable] The final user. DELETE FAIL. 2 of 2. gameIdx: " + intGameIdx); 
    return sendRes(400, error);
  }
  //-------------------------------------------------------------------------

  //-------------------------------------------------------------------------
  // 5. 게임의 정적인 정보를 기록하는 DB에 끝났음을 기록하기: GameTable 
  //    : 게임 시작과 종료시.
  //            db 에 쓸것은 없나? 없지. 일단 toss 첫번쨰로 해야 시작되니까.  
  //            가 아니고, 다음 항목들을 GameTable 에 써줘야 한다. ???
  //            제일 중요한건, GameIdx 를 받아와야 하니까. ???
  //-------------------------------------------------------------------------
  
  /* 
  !! 혹시나 지우지 말것. 2021.09.28 !!

  //- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  // 5.1 방금 기록한 프로그래스테이블에서, 끝났다고 기록한 시간을 읽어온다. 
  //     게임이 끝난 시간은, 마지막 사용자가 이 토스 게임을 호출해서,
  //     프로그래스 테이블에 기록한 시간으로 한다. 읽어와야지. 
  //- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  try{
    TABLE_NAME = 'GameProgressTable';

    const query_selectFinal_GameProgress = 'SELECT tossedTime FROM ' + TABLE_NAME + ' ' + 'WHERE progressIdx=' + intProgressIdx + ';';

    queryResult = await queryThisFromTheTable(query_selectFinal_GameProgress);

  }catch(error){
    console.log("[TossGame] [Error] [GameProgressTable] The final user toss time. SELECT FAIL. 1 of 2. DB Access or etc.:  " + " > " + error);
    console.log("[TossGame] [Error] [GameProgressTable] The final user toss time. SELECT FAIL. 2 of 2. intProgressIdx: " + intProgressIdx); 
    return sendRes(400, error);
  }  
  let dateFinalUserTossedTime = queryResult[0].tossedTime;

  //- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  // 5.2 기존 게임테이블에서 업데이트 할 것은 이것 두개. 
  //     GameTable 의 PK는 gameIdx.
  //     status 를 1에서 2로. 
  //     endTime 을 null 에서 최종플레이한 사용자가 프로그래스 테이블에 기록된 시간으로. 
  //- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  try{
    TABLE_NAME = 'GameTable';

    const query_EndGame_GameTable = 'UPDATE ' + TABLE_NAME + ' SET ' + 'status=' + intGameStatus + ', ' 
                                                                     + 'endTime=' + dateFinalUserTossedTime 
                                                                     + ' ' + 'WHERE gameIdx=' + intGameIdx + ';';

    queryResult = await queryThisFromTheTable(query_EndGame_GameTable);

  }catch(error){
    console.log("[TossGame] [Error] [GameTable] End game update. UPDATE FAIL. 1 of 2. DB Access or etc.:  " + " > " + error);
    console.log("[TossGame] [Error] [GameTable] End game update. UPDATE FAIL. 2 of 2. gameIdx: " + intGameIdx); 
    return sendRes(400, error);
  } 
  !! 혹시나 지우지 말것. 2021.09.28 !!
  */

  //- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  // 5.3 기존 게임테이블에서 업데이트 할 것은 이것 두개. 
  //     GameTable 의 PK는 gameIdx.
  //     status 를 1에서 2로. 
  //     endTime 을 null 에서 지금 시간으로. 왜? 이 값이 db 자체의 utc 시간으로 기록되게 하기위해. 
  //     끝난 시간은, 랭킹이나, 최신등을 보여줄 때 활용도가 높으므로, 혹시나 해서, 그냥 db의 나우로 기록해준다. 
  //     (그래봐야 under 1sec 일 거다. )
  //- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  try{
    TABLE_NAME = 'GameTable';

    const query_EndGame_GameTable = 'UPDATE ' + TABLE_NAME + ' SET ' + 'status=' + intGameStatus 
                                                                     + ', ' + 'endTime=Now()' 
                                                                     + ' ' + 'WHERE gameIdx=' + intGameIdx + ';';

    queryResult = await queryThisFromTheTable(query_EndGame_GameTable);

  }catch(error){
    console.log("[TossGame] [Error] [GameTable] End game update. UPDATE FAIL. 1 of 2. DB Access or etc.:  " + " > " + error);
    console.log("[TossGame] [Error] [GameTable] End game update. UPDATE FAIL. 2 of 2. gameIdx: " + intGameIdx); 
    return sendRes(400, error);
  } 

  //-------------------------------------------------------------------------

  //-------------------------------------------------------------------------
  // 6. 참여했던 '모든' 플레이어에게 FCM 토큰을 날리기. : 지금 끝낸 gameIdx 만.
  //    
  //-------------------------------------------------------------------------
  // 이제 finishedUsers 에는 맥스턴 개수 만큼의 사용자에 데이터가 채워져 있을 것이므로. 
  try{
    
    let finishedUsersPushResults=null;
    for(var push_idx = 0; push_idx < intMaxTurn; push_idx++)
    {
      var strFinishedUserToken = event.finishedUsers[push_idx].pushToken;
      finishedUsersPushResults = await sendPush_v03_forEndGame(event, strFinishedUserToken);
    }

    // 다 성공했을 경우. // JS협의 202109.28
    //return sendRes(200, finishedUsersPushResults);

    const endGameResponseData = {
      numOfUsers: intMaxTurn,
      msg: 'The End of Game. All FCM Sendings are successful.'
    };
    return sendRes(200, endGameResponseData);

  }catch(error){
    console.log( "[TossGame] [Error] Final For Loop. FCM Push FAIL!! " + error + ", gameIdx: " + intGameIdx);
    return sendRes(420, error);
  }

  //-------------------------------------------------------------------------

  // 이제 끝난건가? 




} // END of C. 게임이 끝났을 경우의 처리.   
else
{
//#########################################################################
//=========================================================================
// D. 게임 데이터에 문제가 있을 경우: 
//=========================================================================
//#########################################################################
  const err_msg = "[Toss] [Serious Error!!] Dropped game or abnormal game! gameIdx: " + intGameIdx + ", status num: " + intGameStatus;
  console.log( err_msg );
  return sendRes(405, err_msg);

}

  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // return { message: 'Go Serverless v1.0! Your function executed successfully!', event };
};
