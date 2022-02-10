//-------------------------------------------------------------------------------------
// Project: SketchBird
// DB: mysql.
// 
// 게임을 토스할 떄 쓰는 람다. : TossGameV3
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
// 2021.11.09. sjjo. 게임인덱스를 기존 스트링(앱) 인트(람다및sql테이블) 혼용에서, 인트 로 통일. JY요청. 
//
// 2021.11.11. sjjo. 게임인포.프로그래스 필드를 앱에서가 아닌, 서버에서 상황에 따라 변경하는 것으로. JY협의.  
//                   이거 그러면, 매번 여기에서 정확하게 판단해서 값 정해줘야. 그래야 나머지 로직이.
//                   gameInfo.progess.
//                   ## 중요!! 최종다한 마지막 사용자가 이걸 호출하면, gameIno.currentTurn 에 maximumTrun+1 값을 채워서 온다. 
//                             e.g. 6, 7 이렇게. 그래야 최종 사용자 판단을 할수 있음. 
//                    
// 2021.11.11. sjjo. 센드 리스폰스, 에러 쓰로우하는 걸로 이제 바꿈. 하는 김에.
//
// 2021.11.23. sjjo. 게임이 (무사히) 끝났을 때, 레이팅의 상태를 초기화 해서 기록하는 코드 추가: ScoreCountTable.
//                   별 필요없다 싶은 콘솔.로그 주석처리.
// 
// 2021.11.30. sjjo. 게임완료후 레이팅 관련 쿼리 결과가 나오게 하기 위해서, 스코어테이블 뿐만 아니라, 레이팅스떼더스 테이블도 초기화 하는 코드 추가. 
//                   RatingStatusTable
//
// 2021.12.14. sjjo. 기존의 v1을 v2로 변경. pool 방식으로 변경. 레이팅 관련 테이블 2개 다 잘 만지는지 확인 함. 
// 2021.12.14. sjjo. 비용 절감?과 성능 향상? 을 위해, 정상적인 경우의 로그 코드 없애는 오버라이드 함수 작성. 
// 
// 2021.12.23. sjjo. Unseen 관련 처리를 위해서, 게임이 완료되었을 때 해당 테이블을 세팅하는 코드 추가 시작. 
//
//-------------------------------------------------------------------------------------
// 대공사!
// 2022.01.06. sjjo. 람다 호출, 쿼리비용 최소화를 위해서, 강제 리펙토링... feat. JY. ㅡ_ㅜ
//                   __0106DG__
    /*
    TossGame V4 : 
    ING 일 때는, gamInfo, finishedUser 1명, nextUser 1명 데이터 자체를FCM 으로 날린다. 
    END 일 때는, currentTurn 숫자보고 마지막인지 판단해서, 참여했던 플레이어 정보 다 가져와서, 테이블에 기록하고, FCM 다 날리기. 
    getGameInfo :  그대로. 
    */
//
//
// 2022.01.13. sjjo. FCM 메시지에 다음을 추가. JY 요청. FCM 메시지를 앱단에서 구분하기 위해. 
//                   '"datatype" : "JORUGI"' // JORUGI, DELEGATE, ING, FINISHED 
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

//--------------------------------------------------------------------------------------
// 0==일단만들어짐(첫토스이전), 1==진행중, 2==완료, 3==드롭, 4==뭔가 문제? 
// assign 되는 숫자 바꿀려면, CreateGame, TossGame, GetGameInfo 3군데 코드 다 바꿔야 함!
const CONST_GAME_STATUS__START = 0;
const CONST_GAME_STATUS__ING = 1;
const CONST_GAME_STATUS__END = 2;
const CONST_GAME_STATUS__DROP = 3;
const CONST_GAME_STATUS__ERR = 4;

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



async function queryThisFromTheTable( query_str ){
  return new Promise( (resolve, reject) => {

    pool.query(query_str, function(err, result, fields) {
      if(result)
      {
          resolve(result);
      }
      if(err)
      {
          const errMsg = "[TossGameV4] [ERROR]: db-error:" + err;
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




// 2021.11.11
// const isLocal = 0; // 아직 로컬 실행인지 확인하는 방법 모르겠다. 
// feat. JY.
// var os = require('os'); console.log( os.hostname() );
// 근데 이거 계속 부를 때마다 실행하는게 맞나? 실행시간.. 
// 일단 실행시간 써도될 꼭 필요한 경우만 쓰자. 
//---------------------------------

//---------------------------------------------------------------------
// 표준 response 를 보내기 위해. + 에러 리스폰스 처리를 합침.
// : 기존 sendRes와 sendErr를 합침. 
//    * AWS Lambda 에 deploy 후에 실행시, response 에 \ 붙는 문제 해결 관련해서
//      body의 형식을 나눔. 정말 생고생했다.. 이런거 때매.. 
//    * error 를 쓰로우 해야, http response 가 해당 코드대로 제대로 간다 .
//    * feat. JY ref: https://dikshit18.medium.com/mapping-api-gateway-with-lambda-output-e8ea9e435bbf 
//---------------------------------------------------------------------
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
      if(status == 200)
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
//===========================================================================
function sendPush_v04(event, token) {

  const https = require('https');
  

  // 진행중 게임용으로 다시 살림. 2021.09.28
  // 나중에 gameInfo에 언어코드 읽어서, 언어별로 해주면 되지. 
  const inggame_title = "SketchBird: 짹짹!!";

  //const inggame_body = event.finishedUsers[(event.gameInfo.currentTurn-2)].nickname + " 에게서 그림쪽지가 도착했어요!";  
  const inggame_body = event.finishedUsers[0].nickname + " 에게서 그림쪽지가 도착했어요!";  
  
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
      '"datatype" : "ING"'+
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
          console.log('[TossGameV4] @@@ :( [FCM Sending] failure' + e.message);
          reject(e.message);
      });
      
              
      // 쓸데없는 log 는 빼자. console.log(reqMiniBody);

      req.write(reqMiniBody);
      req.end();
  });
      
}

//===========================================================================
// FCM 날리는 부. Ver. 03. 2021.09.13
// fcm 날릴 때, 데이터 부분에, 기존 JSON 전체 대신에, gameUid 만 실어보내는 방식.
// 거기에, return도 성공시, 보낸 userUid string 만. 
//
// 2022.01.13 현재 사용안함. v04를 대신 사용함. 
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
      '"json":' + event.gameInfo.id +
    '}'+
  '}';

/* 2021.11.09 DELETED. 게임아이디를 인트 로 받기로 해서.
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
*/                  

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
          console.log('[TossGameV4] @@@ :( [FCM Sending] failure' + e.message);
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

  // 프로그래스로 끝남을 알림. __0106DG__
  const fcmJsonBody = {
    gameInfo: {
      id: event.gameInfo.id,
      progress: 2
    }
  };

  const str_fcmJsonBody = JSON.stringify(fcmJsonBody); // 추가 해야함? 이렇게 해야 FCM이 제대로 날아감.



  //-----------------------------------------------------------------------
  // 끝난 게임용으로 다시 살림. 2021.09.28
  // 나중에 gameInfo에 언어코드 읽어서, 언어별로 해주면 되지. 
  const endgame_title = "SketchBird: 짹짹!!";
  const endgame_body = event.gameInfo.maximumTurn + "턴 짜리 그림이 완성되었어요!";
  const endgame_image = "https://sjtest0204-upload.s3.ap-northeast-2.amazonaws.com/sb_endgame_img.png";
  const reqMiniBody = '{"to":"' + token +'",' +
                  '"priority" : "high",' +
                  '"notification" : {' +
                    '"title": "' + endgame_title +'",'+  
                    '"image": "' + endgame_image +'",'+
                    '"click_action" : "FLUTTER_NOTIFICATION_CLICK",'+ 
                    '"body": "' + endgame_body + '"'+ 
                  '},' +
                  '"data" : {'+
                      '"click_action" : "FLUTTER_NOTIFICATION_CLICK",'+
                      '"screen" : "/game/receive", '+
                      '"datatype" : "FINISHED"'+
                      '"json":' + str_fcmJsonBody +
                    '}'+
                  '}';
  // JORUGI, DELEGATE, ING, FINISHED

  /* 2021.11.09 DELETED. 게임아이디를 인트 로 받기로 해서.  
  const reqMiniBody = '{"to":"' + token +'",' +
                  '"priority" : "high",' +
                  '"notification" : {' +
                    '"title": "' + endgame_title +'",'+  
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
  */

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
          console.log('[TossGameV4] @@@_@@@ : For end game!: [FCM Sending] failure' + e.message);
          reject(e.message);
      });
      
              
      // 쓸데없는 log 는 빼자. console.log(reqMiniBody);

      req.write(reqMiniBody);
      req.end();
  });
      
  }

module.exports.TossGameV4 = async (event) => {


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
  
  /* 2021.11.09. DELETED
  const strGameIdx = event.gameInfo.id; 
  const intGameIdx = strGameIdx * 1; 
  */
  const intGameIdx = event.gameInfo.id; // 이제 인트 로 넘어옴.

  
  const intMaxTurn = event.gameInfo.maximumTurn; // 위치 옮김. 2021.09.27

  let intProgressIdx = null; // GameProgressTable 에 인서트 하고, 얻어올 인덱스 값. 위치 옮김. 2021.09.27


  
  let intGameStatus; // 0==일단만들어짐(첫토스이전), 1==진행중, 2==완료, 3==드롭, 4==뭔가 문제? assign 바꿀려면, CreateGame쪽 코드도 같이 바꿔야.
  // 이제는 이값을 서버에서 판단. 
//#########################################################################
//=========================================================================
//
// 가장먼저. 현재 게임프로그래스를, 서버단에서 판단. 
// 2021.11.11. (세부내역은 최상단 주석 참조.)
//
//#########################################################################
//=========================================================================
  //이제는 이값이 int. 2021.09.08.
  // 기존코드. intGameStatus = event.gameInfo.progress; // BUG_FIX. 2021.09.23. 2번째 모의 턴을 돌려보다가. 
  const intRawDataForGameStatus = intMaxTurn - event.gameInfo.currentTurn;
  
  // 2021.11.11. 디버그용 로그
  //console.log("1111: Max, Current, Max - Current: " + intMaxTurn + ", "+ event.gameInfo.currentTurn + ", " + intRawDataForGameStatus); 

  // __0106DG__
  console.logDebug("[TossGameV4] #1. gameIdx: " + intGameIdx + ", maximumTurn: " + intMaxTurn + ", currentTurn: " + event.gameInfo.currentTurn + ", intRawDataForGameStatus: " + intRawDataForGameStatus);
  
  //if( intRawDataForGameStatus > 0) 
  if( intRawDataForGameStatus >= 0) // 마지막 직전 사용자 까지 ING 처리해야. 
  {
      // 게임이 진행중인 경우. 

      // 게임이 진행중인 경우는 2가지로 나뉜다. 
      // 1. 첫 토스인 경우. 
      // 2. 첫 토스이후인 경우. 
      // 왜 나눔? 만들기만하고 첫 토스도 안한경우는 데이터에서 날려야?

      
      if( event.gameInfo.currentTurn == 2 ) // 1. 첫 토스인 경우. 
      { 
        intGameStatus = CONST_GAME_STATUS__START;
        // 바로 밑에서 ING로 바꾸겠지만, GameTable에 첫개시 등록 루틴을 최초 1회 타야하기 때문에, 이렇게 해줘야 함. 
      }else // 2. 첫 토스 이후인 경우. 
      { 
        intGameStatus = CONST_GAME_STATUS__ING;
      }

  //}else if( intRawDataForGameStatus == 0)
  }else if( intRawDataForGameStatus < 0) // 아마도 -1
  {
      // 게임이 종료된 경우.
      intGameStatus = CONST_GAME_STATUS__END;

  }else
  {
      // 게임턴과 맥스턴이 문제가 생긴 이상한, 발생해서는 안되는 경우. 
      const err_msg = "[TossGameV4]] [Serious Error!!] Abnormal turn number! "
                            + "gameIdx: " + intGameIdx + ", maxinumTrun: " + intMaxTurn + ", currentTurn: " + event.gameInfo.currentTurn;
      console.log( err_msg );
      return sendRes(405, err_msg);
  }
  


  // 디버그용 로그
  console.logDebug("[TossGameV4] #2. Whole event: " + JSON.stringify(event) );
  console.logDebug("[TossGameV4] #3. Decided intGameStatus: " + intGameStatus + ", intGameIdx: " + intGameIdx + ", currentTurn: " + event.gameInfo.currentTurn );


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

  console.logDebug("[TossGameV4] #4 nextUserId: " + strNextUserUid + ", intGameIdx: " + intGameIdx);

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
        console.log("[TossGameV4] [Error] [GameTable] game status UPDATE FAIL. DB Access or etc.:  " + " > " + error);
        return sendRes(400, error);
      }

  }
  // 예외처리 할 경우. return sendRes(410, "Game JSON data error! Field: gameInfo.progress ");

  

  //-------------------------------------
  // 기존 ddb JSON 들과 호환을 유지하기 위한 text <-> int 매핑.   
  //console.log("## 2021.12.02-1: userIdx: " + intUserIdx + ", gameInfo.currentTurn: " + event.gameInfo.currentTurn );
  const debugMsg = "Game JSON data Check #0. Field: gameInfo.finishedUsers[#].type : draw or word type. >> "
  + "gameIdx: " + intGameIdx 
  + ", strNextUserUid: " + strNextUserUid + ", event.gameInfo.currentTurn: " + event.gameInfo.currentTurn;
  console.logDebug(debugMsg);  

  // __0106DG__
  // const strDrawType = event.finishedUsers[(event.gameInfo.currentTurn-2)].type;
  const strDrawType = event.finishedUsers[0].type; // 게임이 진행중인 경우, 이제는 무조건 1명의 최근 사용자 정보만 여기 있으므로. 


  let intDrawType; // 0 == draw 그릴 차례, 1 == word 단어를 맞출(쓸) 차례.
  switch( strDrawType ){ 
    case "draw": 
      intDrawType = 0;  
      break;
    case "word":
      intDrawType = 1;
      break;
    default:
      //console.log("## 2021.12.02-2: userIdx: " + intUserIdx + ", gameInfo.currentTurn: " + event.gameInfo.currentTurn + ", THAT type: " + strDrawType);
      const errMsg = "Game JSON data error! #1. Field: gameInfo.finishedUsers[#].type : draw or word type. >> "
                      + "gameIdx: " + intGameIdx 
                      + ", strNextUserUid: " + strNextUserUid + ", event.gameInfo.currentTurn: " + event.gameInfo.currentTurn;
      console.log(errMsg);
      return sendRes(410, errMsg);
      // return sendRes(410, "Game JSON data error! Field: gameInfo.finishedUsers[#].type : draw or word type.");            
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
    console.log("[TossGameV4] [Error] [UserTable] SELECT FAIL. DB Access or etc.:  " + " > " + error);
    return sendRes(400, error);
  }

  // 예외처리. 2021.09.24
  if(queryResult.length == 0) 
  {
    const err_msg = "[TossGameV4] [Error] [UserTable] There is NO such a user!";
    console.log(err_msg);
    return sendRes(402, err_msg);
  }
  if(queryResult.length > 1 )
  {
    const err_msg = "[TossGameV4] [Error] [UserTable] There are more than ONE user!";
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

  // __0106DG__
  /*
  const intUserIdx = event.finishedUsers[(event.gameInfo.currentTurn-2)].userIdx; // 둘이 헛갈리지 마셈.
  const strImageUrl = event.finishedUsers[(event.gameInfo.currentTurn-2)].imgUrl;
  */
  // __0106DG__
  const intUserIdx = event.finishedUsers[0].userIdx; // 둘이 헛갈리지 마셈.
  const strImageUrl = event.finishedUsers[0].imgUrl;

  // HERE!!!
  //console.logDebug("[TossGameV4] ##[INFO 2]## a: " + event.gameInfo.currentTurn + ", b: " + event.finishedUsers[(event.gameInfo.currentTurn-2)].userIdx);
  console.logDebug("[TossGameV4] #5. currentTurn: " + event.gameInfo.currentTurn + ", The latest finished UserIdx: " + intUserIdx
                                                    + ", imgUrl: " + strImageUrl);


  //------------------------------------- @@ 앱단과 논의 @@ +OK주석.
  // 다음사람이(nextUser) 할 턴의 회차. 지금 막 완료한 사용자의 턴수? 토스 받은 사람이 할 턴수?
  // 그러니까, 첫 만든 사람이 그리면 1이고, create_game 이후에, toss_game이 [처음] 호출되면 바로 2가 된 상태로 온다.
  // __0106DG__
  /*
  const intTurnNumber = event.finishedUsers[(event.gameInfo.currentTurn-2)].turnNum; // 지금 그린 사람의 턴수. 1 부터 시작.  

  // 지역도 있어야지. 가장 최근에 끝낸 사람의 지역.  @@ 앱단과 논의 @@ +OK주석.
  const strCurrentRegion = event.finishedUsers[(event.gameInfo.currentTurn-2)].country;
  */
  // __0106DG__
  const intTurnNumber = event.finishedUsers[0].turnNum; // 지금 그린 사람의 턴수. 1 부터 시작.    
  const strCurrentRegion = event.finishedUsers[0].country; // 지역도 있어야지. 가장 최근에 끝낸 사람의 지역.  @@ 앱단과 논의 @@ +OK주석.

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

    // DEBUG Do NOT delete.
    // console.log("ING: ProgressTable:" + query_insertGameProgress);

    queryResult= await queryThisFromTheTable(query_insertGameProgress);

    intProgressIdx = queryResult.insertId; // 방금 인서트한 프로그래스 id를 저장하고,

    //return sendRes(200, resultUserInfo);

  }catch(error)
  {
    //console.log("[TossGameV4] [Error] [GameProgressTable] INSERT FAIL. 1 of 2. DB Access or etc.:  " + " > " + error);
    //console.log("[TossGameV4] [Error] [GameProgressTable] INSERT FAIL. 2 0f 2. gameIdx:  " + strGameIdx + " integered gameIdx: " + intGameIdx.toString() ); // 혹시모르니, gameIdx를 확인하자. str int 모두.
    console.log("[TossGameV4] [Error] [GameProgressTable] INSERT FAIL. 1 of 2. DB Access or etc. gameIdx: " + intGameIdx
                  + "  >> " + error);
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
      //return sendRes(410, "Game JSON data error! Field: event.nextUser.type ");
      const errMsg = "Game JSON data error! #2 Field:  draw or word type. >> "
                      + "gameIdx: " + intGameIdx 
                      + ", userIdx: " + intUserIdx + ", event.gameInfo.currentTurn: " + event.gameInfo.currentTurn;
      console.log(errMsg);
      return sendRes(410, errMsg);
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
    console.log("[TossGameV4] [Error] [GameCurrentTable] INSERT or UPDATE FAIL. DB Access or etc.:  " + " > " + error);
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
    console.log("[TossGameV4] [Error] [GameHistoryTable] INSERT or UPDATE FAIL. DB Access or etc.:  " + " > " + error);
    return sendRes(400, error);
  }
  
  // 게임 히스토리 테이블 업서트 하고 나면 뭐해야 하지? 일단 FCM 날리기로 가보자. 2021.09.13
  


  /* 
  // __0106DG__
  //-------------------------------------------------------------------------
  // 변경: 사용안함.
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
    console.logDebug("[TossGameV4] ### PUSH OK ###");
    return sendRes(200, pushResult);
    
    
    } catch(error) 
    {
      console.log( "[TossGameV4] [Error] ING. FCM Push FAIL!! " + error + ", FaildUserUid(nextUser): " + strNextUserUid);
      return sendRes(420, error);
    }
  */

  // __0106DG__
  //-------------------------------------------------------------------------
  // 이제는 이벤트 내용을 FCM에 실어서 날리기. 
  // 5. 다음 플레이어에게 FCM 토큰을 날리기. : 게임정보, 가장 최근에 한 사용자의 정보, 다음사람의 정보, 즉 리퀘스트 그대로?!
  // 
  //------------------------------------------------------------------------- 
  try{
    //var pushResultJson = await sendPush(event, userToken);
    //const pushResultJson = await sendPush_v02(event, strNextUserFcmToken); // 2021.05.04. 5월달에 했던걸 지금 또 새로 사용.. 2021.09.13
    //const pushResult = await sendPush_v03(event, strNextUserFcmToken); // 하지말고, v03으로 수정 시도. 왜? json 리스폰스 할 필요도 없고, 성공 실패만. 
    const pushResult = await sendPush_v04(event, strNextUserFcmToken);
    
    
    //console.log("###### ing : createdUserId: " + event.gameInfo.createdUserId + ", createdTime: " + event.gameInfo.createdTime);
    //console.log("@@@@ ING. Push OK.  1/2: curr: " + event.gameInfo.currentTurn + " maxturn: " + event.gameInfo.maximumTurn + " Keyword: " + event.gameInfo.keyword); // 2021.05.22.
    //console.log("@@@@ ING. Push OK.  2/2 : userToekn: " + strNextUserFcmToken + " PushResult: " + pushResultJson);
    console.logDebug("[TossGameV4] #6.  ### PUSH OK ###.  Sent userIdx: " + intNextUserIdx);
    return sendRes(200, pushResult);
    
    
    } catch(error) 
    {
      //console.log( "[TossGameV4] [Error] ING. FCM Push FAIL!! " + error + ", FaildUserUid(nextUser): " + strNextUserUid);
      console.log( "[TossGameV4] [Error] ING. FCM Push FAIL!! " + error + ", FaildUserUid(nextUser): " + strNextUserUid + ", FaildUserIdx(nextUser): " + intNextUserIdx);
      return sendRes(420, error);
    }


} // END of B. 게임이 진행중일 경우의 처리.    
else if( intGameStatus == CONST_GAME_STATUS__END ) 
{
//#########################################################################
//=========================================================================
// C. 게임이 끝났을 경우: 마지막 플레이어가 완료해서, ~~제이슨이 넘어을 경우. ~~
// __0106DG__ 이제는 전체 제이슨이 안넘어 온다! 
// e.g. maximumTurn: 6, currentTurn: 7 로 해서, 피니쉬드 유저에는 turnNum 6으로 해서 넘어온다. 
//      넥스트 유저는 null 이고. 
//=========================================================================
//#########################################################################

  //-------------------------------------------------------------------------
  // 1. 참여했던 사용자들의 FCM 토큰 가져오기. 
  //    : Request로 온 제이슨에 있는, 각 사용자의 FCM토큰을 믿고 그대로 읽어서 사용한다. 
  //    왜? 이 request가 오기 '직전'에, 앱단에서 GetGameInfo를 통해 제이슨 구성했을 것이고, 
  //        GetGameInfo 할때, UserTable 쿼리해서 FCM토큰 받아올 것이기 때문. 
  //-------------------------------------------------------------------------
  // 리퀘스트 event 데이터 그대로 사용. 
  // __0106DG__ 이제는 가져와야 함. 뒤에 포루프에서?


  //-------------------------------------------------------------------------
  // 2. DB에 마지막 플레이어의 플레이 정보 전체를 기록하기 : GameProgressTable 
  //    : PK는 gameIdx, progressIdx, KEY는 gameIdx.
  //    : 한게임*턴수 만큼 열이 생김. (GameIdx 가 partition). 턴이 넘어갈 때마다 insert 가 됨.  
  //    그리든, 쓰든, "완료한 사람" 에 해당해서만 기록.  @@ 앱단과 논의 @@ +OK주석. 
  //-------------------------------------------------------------------------

  // 1111 디버깅용 로그 추가. 
  //console.log("1111: turnNum" + event.finishedUsers[(event.gameInfo.maximumTurn-1)].turnNum);
  //console.log("1111: imgUrl" + event.finishedUsers[(event.gameInfo.maximumTurn-1)].imgUrl);
  //console.log("1111: userIdx" + event.finishedUsers[(event.gameInfo.maximumTurn-1)].userIdx);

  /* // __0106DG__
  const intFinal_UserIdx = event.finishedUsers[(event.gameInfo.maximumTurn-1)].userIdx; 
  const strFinal_ImageUrl = event.finishedUsers[(event.gameInfo.maximumTurn-1)].imgUrl;
  const intFinal_TurnNumber = event.finishedUsers[(event.gameInfo.maximumTurn-1)].turnNum; 
  const strFinal_CurrentRegion = event.finishedUsers[(event.gameInfo.maximumTurn-1)].country;
  */
  // __0106DB__
  const intFinal_UserIdx = event.finishedUsers[0].userIdx; 
  const strFinal_ImageUrl = event.finishedUsers[0].imgUrl;
  const intFinal_TurnNumber = event.finishedUsers[0].turnNum; 
  const strFinal_CurrentRegion = event.finishedUsers[0].country;

  //-------------------------------------
  // 기존 ddb JSON 들과 호환을 유지하기 위한 text <-> int 매핑.   
  // const strFinal_DrawType = event.finishedUsers[(event.gameInfo.maximumTurn-1)].type;
  const strFinal_DrawType = event.finishedUsers[0].type; // __0106DB__
  let intFinal_DrawType; // 0 == draw 그릴 차례, 1 == word 단어를 맞출(쓸) 차례.
  switch( strFinal_DrawType ){ 
    case "draw": 
      intFinal_DrawType = 0;  
      break;
    case "word":
      intFinal_DrawType = 1;
      break;
    default:
      //return sendRes(410, "Game JSON data error! Field: gameInfo.finishedUsers[#].type : draw or word type.");
      const errMsg = "Game JSON data error! #3 Field:  draw or word type. >> "
                      + "gameIdx: " + intGameIdx 
                      + ", Final userIdx: " + intFinal_UserIdx 
                      + ", intFinal_TurnNumber: " + intFinal_TurnNumber
                      + ", event.gameInfo.currentTurn: " + event.gameInfo.currentTurn;
      console.log(errMsg);
      return sendRes(410, errMsg);
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
    //console.log("[TossGameV4] [Error] [GameProgressTable] The final user. INSERT FAIL. 1 of 3. DB Access or etc.:  " + " > " + error);
    //console.log("[TossGameV4] [Error] [GameProgressTable] The final user. INSERT FAIL. 2 of 3. gameIdx:  " + strGameIdx + " integered gameIdx: " + intGameIdx.toString() ); // 혹시모르니, gameIdx를 확인하자. str int 모두.
    //console.log("[TossGameV4] [Error] [GameProgressTable] The final user. INSERT FAIL. 3 of 3. The final userIdx:  " + intFinal_UserIdx ); 

    //console.log("[TossGameV4] [Error] [GameProgressTable] The final user. INSERT FAIL. 1 of 2. DB Access or etc.:  " + " > " + error);
    //console.log("[TossGameV4] [Error] [GameProgressTable] The final user. INSERT FAIL. 2 of 2. gameIdx: " + intGameIdx + ", The final userIdx: " + intFinal_UserIdx );
    const errStr = "[TossGameV4] [Error] [GameProgressTable] The final user. INSERT FAIL!! gameIdx: " + intGameIdx + ", The final userIdx: " + intFinal_UserIdx + ", error: " + error;
    console.log( errStr );
    return sendRes(400, errStr);
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
    //console.log("[TossGameV4] [Error] [GameHistoryTable] The final user. INSERT or UPDATE FAIL. 1 of 2. DB Access or etc.:  " + " > " + error);
    //console.log("[TossGameV4] [Error] [GameHistoryTable] The final user. INSERT or UPDATE FAIL. 2 of 2. The final userIdx:  " + intFinal_UserIdx + ", gameIdx: " + intGameIdx); 
    const errStr = "[TossGameV4] [Error] [GameHistoryTable] The final user. INSERT or UPDATE FAIL. gameIdx: " + intGameIdx + ", The final userIdx: " + intFinal_UserIdx + ", error: " + error;
    console.log( errStr );
    return sendRes(400, errStr);
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
    //console.log("[TossGameV4] [Error] [GameCurrentTable] The final user. DELETE FAIL. 1 of 2. DB Access or etc.:  " + " > " + error);
    //console.log("[TossGameV4] [Error] [GameCurrentTable] The final user. DELETE FAIL. 2 of 2. gameIdx: " + intGameIdx); 
    const errStr = "[TossGameV4] [~~ SERIOUS Error ~~] [GameCurrentTable] The final user. <DELETE FAIL>. gameIdx: " + intGameIdx + ", error: " + error;
    console.log( errStr );
    return sendRes(400, errStr);
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
    console.log("[TossGameV4] [Error] [GameProgressTable] The final user toss time. SELECT FAIL. 1 of 2. DB Access or etc.:  " + " > " + error);
    console.log("[TossGameV4] [Error] [GameProgressTable] The final user toss time. SELECT FAIL. 2 of 2. intProgressIdx: " + intProgressIdx); 
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
    console.log("[TossGameV4] [Error] [GameTable] End game update. UPDATE FAIL. 1 of 2. DB Access or etc.:  " + " > " + error);
    console.log("[TossGameV4] [Error] [GameTable] End game update. UPDATE FAIL. 2 of 2. gameIdx: " + intGameIdx); 
    return sendRes(400, error);
  } 
  !! 혹시나 지우지 말것. 2021.09.28 !!
  */

  //-------------------------------------------------------------------------  
  // 4.5 이제는 DB에서 현재 끝난 게임에 참여했던 사용자들의 정보를 가져와야 한다!
  //    __0106DG__
  //-------------------------------------------------------------------------
  /*
  SELECT H.userIdx, U.fcmToken FROM GameHistoryTable AS H
				INNER JOIN UserTable AS U ON H.userIdx=U.userIdx 
				WHERE H.gameIdx=339;
  */
  // ##### 거의 바로 위에서 게임 히스토리 테이블 업서트 했는데, 바로 읽으면 제대로 값 들어와 있나? ###### 2022.01.06.

  try{
    const query_ParticipatedUsersForThisEndGame = 'SELECT H.userIdx, U.fcmToken FROM GameHistoryTable AS H'
                                                      + ' ' + 'INNER JOIN UserTable AS U ON H.userIdx=U.userIdx'
                                                      + ' ' + 'WHERE H.gameIdx=' + intGameIdx + ';';

    queryResult = await queryThisFromTheTable(query_ParticipatedUsersForThisEndGame);                                                    

  }catch(error){
    const errStr = "[TossGameV4] [~~SERIOUS~~ Error] [GameHistoryTable, UserTable] End Game proc. SELECT Fail. gameIdx: " + intGameIdx + ", error: " + error;
    console.log( errStr );
    return sendRes(400, errStr);
  }

  const endGame_NumOfParticipatedUsers = queryResult.length;

  // 예외처리. 
  if( (endGame_NumOfParticipatedUsers <= 0) || ( endGame_NumOfParticipatedUsers > intMaxTurn) )
  {
    const errStr = "[TossGameV4] [~~SERIOUS~~ Error] The number of the participated users are abnormal: " 
                     + "gameIdx: " + intGameIdx + ", endGame_NumOfParticipatedUsers(in GameHistoryTable): " + endGame_NumOfParticipatedUsers
                     + ", maxTurn: " + intMaxTurn;

    console.log( errStr );
    return sendRes(405, errStr);
  }
  // 이제 쿼리 결과 루프 돌면서, 데이터 만들고 이걸로 이거 이후 코드에서 쓰자. ZOMAN
  let arrayFinishedUsersForThisEndGame = new Array();

  for(var idx=0; idx<endGame_NumOfParticipatedUsers; idx++)
  {

    arrayFinishedUsersForThisEndGame.push(
      {
        userIdx: queryResult[idx].userIdx, 
        pushToken: queryResult[idx].fcmToken
      }
    );

  }


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
    //console.log("[TossGameV4] [Error] [GameTable] End game update. UPDATE FAIL. 1 of 2. DB Access or etc.:  " + " > " + error);
    //console.log("[TossGameV4] [Error] [GameTable] End game update. UPDATE FAIL. 2 of 2. gameIdx: " + intGameIdx); 
    const errStr = "[TossGameV4] [~~SERIOUS~~ Error] [GameTable] End game update. UPDATE FAIL. gameIdx: " + intGameIdx + ", error: " + error;
    console.log( errStr );
    return sendRes(400, errStr);
  } 

  //- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  // 5.4 FCM 날리기 직전에, 레이팅(스코어) 테이블을 만져야지. 2021.11.23
  //     ScoreCountTable 의 PK는 gameIdx.
  //- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  try{
    TABLE_NAME = 'ScoreCountTable';
    // 처음이니까, 0, 0 으로. 업서트 할필요는 없겠지? 
    const query_EndGame_ScoreCountTable = 'INSERT INTO ' + TABLE_NAME + ' '
                                              + '('
                                              + 'gameIdx'
                                              + ', funScore'
                                              + ', goldHandScore'
                                              + ') '

                                              + 'VALUES ('
                                              +  intGameIdx
                                              + ', ' + 0
                                              + ', ' + 0                                              
                                              +') '


    queryResult = await queryThisFromTheTable(query_EndGame_ScoreCountTable);

  }catch(error){
    const errMsg = "[TossGameV4] [Error] [ScoreCountTable] INSERT FAIL or DB Access. gameIdx: " + intGameIdx +  " > "  + error;
    console.log(errMsg); 
    return sendRes(400, errMsg);
  } 

  //- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  // 5.5 FCM 날리기 직전에, 레이팅 스떼더스 테이블도 만져야지. 2021.11.30
  //     RatingStatusTable 는 userIdx 와 gameIdx의 유니크 키페어.
  //- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  // 참여했던 모든 사용자와 이 게임인덱스의 조합을 다 기록해야 하니,
  // 인서트 문을 통째로 만들어서 쿼리하자. 
  // e.g. INSERT INTO RatingStatusTable (userIdx, gameIdx, checkedFun, checkedGoldhand, checkedReport) VALUES (1, 2, false, false, false);

  // INSERT INTO RatingStatusTable (userIdx, gameIdx, checkedFun, checkedGoldhand, checkedReport) VALUES (25, 250, 0, 0, 0),(26, 250, 0, 0, 0),(25, 250, 0, 0, 0),(26, 250, 0, 0, 0) ON DUPLICATE KEY UPDATE checkedFun=0;
  // 한줄로 해야 에러가 안난다?
  let multipleInsertStr = "INSERT INTO RatingStatusTable (userIdx, gameIdx, checkedFun, checkedGoldhand, checkedReport) VALUES ";

  let multipleInsertStrForUnseen = "INSERT INTO UnseenTable (userIdx, gameIdx, createdTime) VALUES ";   // 5.6 용.

  //for(var idx=0; idx < intMaxTurn; idx++) __0106DG__
  for(var idx=0; idx < endGame_NumOfParticipatedUsers; idx++) // __0106DG__
  {
    /*var insertStr = "INSERT INTO RatingStatusTable (userIdx, gameIdx, checkedFun, checkedGoldhand, checkedReport) VALUES ("
                        + event.finishedUsers[idx].userIdx + ", " + intGameIdx + ", 0, 0, 0); "; */
    // 중복된 사용자가 체인에 있는 경우를 대비해서 업서트 해야한다. 안그러면 에러. 
    /*var insertStr = "INSERT INTO RatingStatusTable (userIdx, gameIdx, checkedFun, checkedGoldhand, checkedReport) VALUES ("
            + event.finishedUsers[idx].userIdx + ", " + intGameIdx + ", 0, 0, 0) "
            + "ON DUPLICATE KEY UPDATE checkedFun=0;"; // 어차피 인서트에서 초기화 되었을 것이므로, 이것만 해도 되지 않을까?
    */
    var insertStr = "";
    var insertStrforUnseen = ""; // 5.6 용.

    //if(idx == 0) insertStr = "(" + event.finishedUsers[idx].userIdx + "," + intGameIdx + ", 0, 0, 0)";
    //else insertStr = ",(" + event.finishedUsers[idx].userIdx + "," + intGameIdx + ", 0, 0, 0)";

    if(idx == 0){
      
      //insertStr = "(" + event.finishedUsers[idx].userIdx + "," + intGameIdx + ", 0, 0, 0)";
      //insertStrforUnseen = "(" + event.finishedUsers[idx].userIdx + "," + intGameIdx + ", Now())"; // 5.6 용
      // __0106DG__
      insertStr = "(" + arrayFinishedUsersForThisEndGame[idx].userIdx + "," + intGameIdx + ", 0, 0, 0)";
      insertStrforUnseen = "(" + arrayFinishedUsersForThisEndGame[idx].userIdx + "," + intGameIdx + ", Now())"; // 5.6 용

    }else{

      //insertStr = ",(" + event.finishedUsers[idx].userIdx + "," + intGameIdx + ", 0, 0, 0)";
      //insertStrforUnseen = ",(" + event.finishedUsers[idx].userIdx + "," + intGameIdx + ", Now())"; // 5.6 용
      // __0106DG__
      insertStr = ",(" + arrayFinishedUsersForThisEndGame[idx].userIdx + "," + intGameIdx + ", 0, 0, 0)";
      insertStrforUnseen = ",(" + arrayFinishedUsersForThisEndGame[idx].userIdx + "," + intGameIdx + ", Now())"; // 5.6 용


    }

    multipleInsertStr += insertStr;
    multipleInsertStrForUnseen += insertStrforUnseen; // 5.6 용

  }

  multipleInsertStr += " ON DUPLICATE KEY UPDATE checkedFun=0;";
  multipleInsertStrForUnseen += " ON DUPLICATE KEY UPDATE createdTime=Now();"; // 5.6 용
  

  console.logDebug("[RatingStatusTable] queryStr: " + multipleInsertStr);
  console.logDebug("[UnseenTable] queryStr:" + multipleInsertStrForUnseen); // 5.6 용

  // 스떼더스 테이블 먼저 만지고, 
  try{

    queryResult = await queryThisFromTheTable(multipleInsertStr);

  }catch(error){
    const errMsg = "[TossGameV4] [Error] [RatingStatusTable] INSERT FAIL or DB Access. gameIdx: " + intGameIdx +  " > "  + error;
    console.log(errMsg); 
    return sendRes(400, errMsg);
  }

  //- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  // 5.6 FCM 날리기 직전에, 언씬 테이블도 만져야지. 2021.12.23 : 하루를 거의 헤맸었는데, 감사합니다. MSJ!
  //     UnseenTable 은 userIdx 와 gameIdx의 유니크 키페어. 필드는 createdTime (즉, 게임이 완료된 시간) 만 있음.
  //- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  // 5.5 에서 했던 것들을 잘 갖다 쓰면 되겠다. 

  // 루프 두번 돌 필요 없으니, 의 루프에서 넣자. 
  /*
  let multipleInsertStrForUnseen = "INSERT INTO UnseenTable (userIdx, gameIdx, createdTime) VALUES ";  
  for(var idx=0; idx < intMaxTurn; idx++)
  {
    var insertStr = "";

    if(idx == 0) insertStr = "(" + event.finishedUsers[idx].userIdx + "," + intGameIdx + ", 0, 0, 0)";
  }
  */
  
  // 언씬 테이블 만지자. 
  try{

    queryResult = await queryThisFromTheTable(multipleInsertStrForUnseen);

  }catch(error){

    const errMsg = "[TossGameV4] [Error] [UnseenTable] INSERT FAIL or DB Access. gameIdx: " + intGameIdx +  " > "  + error;
    console.log(errMsg); 
    return sendRes(400, errMsg);

  }



  //-------------------------------------------------------------------------

  //-------------------------------------------------------------------------
  // 6. 참여했던 '모든' 플레이어에게 FCM 토큰을 날리기. : 지금 끝낸 gameIdx 만.
  //    
  //-------------------------------------------------------------------------
  // 이제 finishedUsers 에는 맥스턴 개수 만큼의 사용자에 데이터가 채워져 있을 것이므로. 
  try{
    
    let finishedUsersPushResults=null;
    // for(var push_idx = 0; push_idx < intMaxTurn; push_idx++) // __0106DG__
    for(var push_idx = 0; push_idx < endGame_NumOfParticipatedUsers; push_idx++) // __0106DG__
    {
      //var strFinishedUserToken = event.finishedUsers[push_idx].pushToken;
      //finishedUsersPushResults = await sendPush_v03_forEndGame(event, strFinishedUserToken);
      // __0106DG__
      var strFinishedUserToken = arrayFinishedUsersForThisEndGame[push_idx].pushToken;
      finishedUsersPushResults = await sendPush_v03_forEndGame(event, strFinishedUserToken);

    }

    // 다 성공했을 경우. // JS협의 202109.28
    //return sendRes(200, finishedUsersPushResults);

    // 이제 할거 다한 건가? 2021.01.06
    // __0106DG__
    console.logDebug("[TossGameV4] #7. <GAME normally END!> gameIdx: " + intGameIdx + ", maxTurn: " + intMaxTurn + ", Num of real player: " + endGame_NumOfParticipatedUsers + ", currentTurn: " + event.gameInfo.currentTurn );


    // 2021.11.09. 필드추가. 어떤 게임인덱스가 끝났는지 알아야 할것 아닌가베?    
    /*
    const endGameResponseData = {
      finishedGameIdx: intGameIdx,
      numOfUsers: intMaxTurn,
      msg: 'The End of Game. All FCM Sendings are successful.'
    };*/
    // __0106DG__
    const endGameResponseData = {
      finishedGameIdx: intGameIdx,
      maximumTurn: intMaxTurn,
      numOfUsers: endGame_NumOfParticipatedUsers,      
      msg: 'The End of Game. All FCM Sendings are successful.'
    };
    return sendRes(200, endGameResponseData);

  }catch(error){
    console.log( "[TossGameV4] [Error] Final For Loop. FCM Push FAIL!! " + error + ", gameIdx: " + intGameIdx);
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
  const err_msg = "[TossGameV4] @@@###!!! [Serious Error!!] Dropped game or abnormal game! gameIdx: " + intGameIdx + ", status num: " + intGameStatus;
  console.log( err_msg );
  return sendRes(405, err_msg);

}

  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // return { message: 'Go Serverless v1.0! Your function executed successfully!', event };
};
