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
// 
//
//-------------------------------------------------------------------------------------

'use strict';

const mysql = require('mysql');

// 넘겨 app auth. 
const authHeader = 'key=AAAAV4RN8sw:APA91bHXNh3Xks6o1bZMlabRX52TFTeuT1CUlmHCmPKs-smY3Xgtn2mYClXi0netKd4LZ2ThSLF9Y9vAvOQdFM-5HVNMZdjQ9V3RuAFJ-hAVoJ2ICb1Mn79TdNCfwrTkQhzRsOBupnfa';


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

const isLocal = 1; // 아직 로컬 실행인지 확인하는 방법 모르겠다. 
// feat. JY.
// var os = require('os'); console.log( os.hostname() );
// 근데 이거 계속 부를 때마다 실행하는게 맞나? 실행시간.. 
// 일단 실행시간 써도될 꼭 필요한 경우만 쓰자. 
//---------------------------------
// 표준 response 를 보내기 위해. 
const sendRes = (status, rcv_body) => {
  
  if( isLocal==0 )
  {
      var response = {
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

      var response = {
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

//---------------------------------------------------
// FCM 날리는 부. Ver. 02.
// fcm 날릴 때, 데이터 부분에, 기존 JSON 전체 대신에, gameUid 만 실어보내는 방식.
// 
function sendPush_v02(event, token) {

  var https = require('https');
  
  
  // 2021.01.29
  var deviceToken = token; //event.nextUser.pushToken;
  var title = event.nextUser.id;
  var body = event.nextUser.type;
  
  // 2021.04.27. Image 필드 추가. JS 요청.
  var imageurl = event.finishedUsers[(event.gameInfo.currentTurn-2)].imgUrl; // TURN_INDEX_20210527
  
  var str_event = JSON.stringify(event);
  // var str_wo_slash_event = '\"' + str_event + '\"';
  var str_wo_slash_event = str_event;
  var abcd = str_wo_slash_event;
  /*
       const reqBody = '{"to":"' + deviceToken +'",' +
                        '"priority" : "high",' +
                        '"notification" : {' +
                          '"title": "' + title +'",'+
                          '"click_action" : "FLUTTER_NOTIFICATION_CLICK",'+ 
                          '"body": "' + body + '"'+
                        '},' +
                        '"data" : {'+
                           '"click_action" : "FLUTTER_NOTIFICATION_CLICK",'+
                           '"screen" : "/game/receive", '+
                           '"json" : '+ abcd +
                          '}'+
                        '}';
  */
  // 2021.04.27. Image 필드 추가. JS 요청.
       const reqBody = '{"to":"' + deviceToken +'",' +
                        '"priority" : "high",' +
                        '"notification" : {' +
                          '"title": "' + title +'",'+
                          '"image": "' + imageurl +'",'+
                          '"click_action" : "FLUTTER_NOTIFICATION_CLICK",'+ 
                          '"body": "' + body + '"'+
                        '},' +
                        '"data" : {'+
                           '"click_action" : "FLUTTER_NOTIFICATION_CLICK",'+
                           '"screen" : "/game/receive", '+
                           '"json" : '+ abcd +
                          '}'+
                        '}';
                        // abcd
      // 2021.05.04.
      var gameUid = event.gameInfo.id;
      
      //console.log("GAME_UID: " + gameUid);
      
      const reqMiniBody = '{"to":"' + deviceToken +'",' +
                        '"priority" : "high",' +
                        '"notification" : {' +
                          '"title": "' + title +'",'+
                          '"image": "' + imageurl +'",'+
                          '"click_action" : "FLUTTER_NOTIFICATION_CLICK",'+ 
                          '"body": "' + body + '"'+
                        '},' +
                        '"data" : {'+
                           '"click_action" : "FLUTTER_NOTIFICATION_CLICK",'+
                           '"screen" : "/game/receive", '+
                           '"json": "' + gameUid +'"' +
                          '}'+
                        '}';
                        
  
  
  var str_a = reqBody;
  //var str_wo_slash_event = str_a.replaceAll("\\\\","/");
  //var str_wo_slash_event = str_a.replace("\\\\/g","");
  
  //var str_wo_slash_event = str_a.stripSlashes() ;
  str_wo_slash_event = str_a; //str_a.stripSlashes() ; // 2021.03.02. sjjo. Fixing the warning.
  
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
  
      console.log(options);
      const req = https.request(options, (res) => {
          console.log('success');
          console.log(res.statusCode);
          //resolve('success yo');
          resolve(str_wo_slash_event);
          
      });
  
      req.on('error', (e) => {
          console.log('failuree' + e.message);
          reject(e.message);
      });
      
              
      //console.log(reqBody);
      console.log(reqMiniBody);
  
      //req.write(reqBody);
      req.write(reqMiniBody);
      req.end();
  });
      
  }

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
  
 

  const reqMiniBody = '{"to":"' + token +'",' +
                  '"priority" : "high",' +
                  '"notification" : {' +
                    '"title": "' + event.nextUser.id +'",'+
                    '"image": "' + event.finishedUsers[(event.gameInfo.currentTurn-2)].imgUrl +'",'+
                    '"click_action" : "FLUTTER_NOTIFICATION_CLICK",'+ 
                    '"body": "' + event.nextUser.type + '"'+
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
  }
                                        

 
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
  // A. 받은 json에서 필요한 정보를 분류한다. 
  //    왜? 이 json 포맷은 내가 테스트 할떄와 실제 정해질 것이 다를 것이기 때문.
  //=========================================================================

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
  
  const strNextUserUid = event.nextUser.id;


  let intGameStatus; // 0==일단만들어짐(첫토스이전), 1==진행중, 2==완료, 3==드롭, 4==뭔가 문제? assign 바꿀려면, CreateGame쪽 코드도 같이 바꿔야.
  //이제는 이값이 int. 2021.09.08.
  intGameStatus = event.gameInfo.progress; // BUG_FIX. 2021.09.23. 2번째 모의 턴을 돌려보다가. 
  //if( event.gameInfo.progress == 0 ) //이제는 이값이 int. 2021.09.08.
  if( intGameStatus == 0 ) 
  {
      // CreateGame 이후, 만든 사람이 처음 토스를 넘긴(TossGame 을 호출한) 경우, 상태를 0에서 1로 바꾼다. 
      intGameStatus = 1;

      //=========================================================================
      // ??. 최초 토스 인 경우 && 게임이 진행중 일 경우. 
      //     : 이 경우에만, GameTable의 status를 0에서 1로 바꿔줘야 한다. 
      //              
      //=========================================================================    
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



  //#########################################################################
  //=========================================================================
  // B-1. 최초 토스 인 경우! 게임이 진행중 일 경우. 
  // @@@@@ !!!! 왜 나눠야함?  @@@@@@
  // 맨 첫 토스인 경우는, 현재 finished 인 첫 만든 사람과, 다음 사람을 같이 progress 에 넣어줘야 하기 때문?
  //=========================================================================
                    // OR
  //#########################################################################
  //=========================================================================
  // B. 게임이 진행중 일 경우. 
  //    finishedUsers 에 있는 사용자들만 insert , upsert 한다. 
  //=========================================================================
  
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
  const strUserUid = event.finishedUsers[(event.gameInfo.currentTurn-2)].id; // 둘이 헛갈리지 마셈.
  // ### 앱단에서 추가해달라고 해야한다. 그래야 progressTable에 바로 넣을 수 있다. 
  const intUserIdx = event.finishedUsers[(event.gameInfo.currentTurn-2)].userIdx; // 둘이 헛갈리지 마셈.
  const strImageUrl = event.finishedUsers[(event.gameInfo.currentTurn-2)].imgUrl;
  const intMaxTurn = event.gameInfo.maximumTurn;

  //------------------------------------- @@ 앱단과 논의 @@ +OK주석.
  // 다음사람이(nextUser) 할 턴의 회차. 지금 막 완료한 사용자의 턴수? 토스 받은 사람이 할 턴수?
  // 그러니까, 첫 만든 사람이 그리면 1이고, create_game 이후에, toss_game이 [처음] 호출되면 바로 2가 된 상태로 온다.
  const intTurnNumber = event.finishedUsers[(event.gameInfo.currentTurn-2)].turnNum; // 지금 그린 사람의 턴수. 1 부터 시작.  

  // 지역도 있어야지. 가장 최근에 끝낸 사람의 지역.  @@ 앱단과 논의 @@ +OK주석.
  const strCurrentRegion = event.finishedUsers[(event.gameInfo.currentTurn-2)].country;

  //-------------------------------------
  // 게임 타입은, 기존 json 에 텍스트 였지만, 2021.09.02 JS와의 협의후, int 로 사용.
  const intGameType = event.gameInfo.gameType; // 0==friend, 1==everyone
  
  

  let intProgressIdx = null;

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
      console.log( "@@@@ ING. Push FAIL!!  Push Message is Failed!: " + error );
      return sendRes(420, error);
    }
    

  //#########################################################################
  //=========================================================================
  // C. 게임이 끝났을 경우: 마지막 플레이어가 완료했을 경우. 
  //=========================================================================

  //-------------------------------------------------------------------------
  //-------------------------------------------------------------------------
  //-------------------------------------------------------------------------


  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // return { message: 'Go Serverless v1.0! Your function executed successfully!', event };
};
