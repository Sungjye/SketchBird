//-------------------------------------------------------------------------------------
// Project: SketchBird
// DB: mysql.
// 
// 나는 이미 내 턴을 완료한 상태에서, (아직 안하고 있는) 바로 다음 사람에게 '조르기' 노티 날리는 람다.
//
// 
// 2021.10.28. sjjo. Initial. TossGame에서 참조. 
// 
//-------------------------------------------------------------------------------------

'use strict';

const mysql = require('mysql');

// 스케치버드 app auth. 
const authHeader = 'key=AAAAV4RN8sw:APA91bHXNh3Xks6o1bZMlabRX52TFTeuT1CUlmHCmPKs-smY3Xgtn2mYClXi0netKd4LZ2ThSLF9Y9vAvOQdFM-5HVNMZdjQ9V3RuAFJ-hAVoJ2ICb1Mn79TdNCfwrTkQhzRsOBupnfa';

const ERR_NOT_RCV_JORUGI_OR_NO_USER = 1;


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
          console.log("[BegNextUser] [ERROR]: db-error:",err);
    });
    mysql_connection.end();
  });
}


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
// FCM 날리는 부. 조르기용. 
// 왜 조르기 전용? 
//   조르기는 누가 했는지 드러나면 좀 부정적 영향일듯.. 그래서 조르기 이미지만 보내기 위해. 
// 
//===========================================================================
function sendPush_v03_forJorugi(game_idx, token) {

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
  const endgame_body = "뒤에서 엄청 기다리고 있다요!"; // 나중에는 남은턴?
  const endgame_image = "https://sjtest0204-upload.s3.ap-northeast-2.amazonaws.com/sb_jorugigame_img.png";

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
                      '"json": "' + game_idx +'"' +
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
      gameIdx: game_idx,
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
          console.log('[@BegNextUser@] :( [FCM Sending] failure' + e.message);
          reject(e.message);
      });
      
              
      // 쓸데없는 log 는 빼자. console.log(reqMiniBody);

      req.write(reqMiniBody);
      req.end();
  });
      
  }



module.exports.BegNextUser = async (event) => {

  
  /*
  // 성공 리스폰스 테스트
  const test_res = {
      gameIdx: 29, 
      nextUserIdx: 3
  };
  //return sendRes(412, test_res);
  return sendRes(200, test_res);
  //sendRes(201, test_res);
  */

  /*
  // 에러 리스폰스 테스트.
  const intRetrievedNextUserIdx = 2;

  const strErrMsg = "[BegNextUser] [ERROR]: This user cannot receive JORUGI or does not exist: userIdx=" + intRetrievedNextUserIdx 
                            + " For this game index: gameIdx=" + event.gameIdx;
  return sendRes(412, strErrMsg);
  */

//-------------------------------------------------------------------------
// 0. 넘어온 값이 널임?...
//-------------------------------------------------------------------------
if( event.gameIdx == null )
{
  const strInfoMsg = '[BegNextUser] [Error] Null data!!!: ' 
                        +'gameIdx: ' + event.gameIdx;
  console.log(strInfoMsg);
  sendRes(402, strInfoMsg);

}  

//#########################################################################
//=========================================================================
// 0. 받은 event에서 기본적으로 필요한 정보를 분류한다. 
//    가독성 위해서.
//=========================================================================
//#########################################################################

const intGameIdx = event.gameIdx;
let queryResult = null;
let strNextUserFcmToken = null;

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
    const queryStr_getFcmTokenForTheVeryNextUser = 'SELECT U.fcmToken '
                                                        + 'FROM UserTable AS U '
                                                        + 'INNER JOIN GameCurrentTable AS G '
                                                        + 'ON U.userIdx=G.nextUserIdx ' 
                                                        + 'WHERE G.gameIdx=' + intGameIdx +';';

    // 조르기 확인 추가 쿼리문.                                                      

    queryResult = await queryThisFromTheTable(queryStr_getFcmTokenForTheVeryNextUser);

    // 딱 한명이 안나오면, 결과가 없으면 에러를 던지고.
    if( queryResult.length != 1 ) throw ERR_NOT_RCV_JORUGI_OR_NO_USER;

    strNextUserFcmToken = queryResult[0].fcmToken;
    //console.log(queryResult[0].fcmToken);

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

      strErrMsg = "[BegNextUser] [ERROR]: [Invalid user to recieve JORUGI or invalid ING game]: The user cannot receive JORUGI or the user does not exist." 
                          + " gameIdx: " + event.gameIdx + ", nextUserIdx: Check GameTable for this gameIdx.";

      // 이런 상황. "조르기를 보낼 사용자가 조르기를 받을 수 없어요. "
      console.log(strErrMsg);
      return sendRes(412, strErrMsg);
    }else
    {
      strErrMsg = "[BegNextUser] [ERROR] SELECT FAIL. DB Access or etc.:  " + " > " + error; 
      console.log(strErrMsg);
      return sendRes(400, strErrMsg);
    }

  }

  //-------------------------------------------------------------------------
  // 3. 아직 안하고 있는 (조르기할) 사용자의 fcm token을 구했다면, 
  //    그 플레이어에게 FCM 토큰을 날리기. : 현재의 gameIdx 만.
  //    
  //  "$$ 님 뒤로 12명의 플레이어가 기다리고 있어욥!" 
  //  뭐 이런걸 앱에서 보여줄 수 있게. 
  //-------------------------------------------------------------------------
  try{

    // HERE. 2021.10.28 Restart 11.02
    // 하지말고, v03으로 수정 시도. 왜? json 리스폰스 할 필요도 없고, 성공 실패만. 
    const pushResult = await sendPush_v03_forJorugi(intGameIdx, strNextUserFcmToken); 

    return sendRes(200, pushResult);  
    
  } catch(error) 
  {

    //let strErrMsg = null;

    const strErrMsg = "[BegNextUser] [ERROR] JORUGI FCM Push FAIL!! " + error;
    console.log( strErrMsg );
    return sendRes(420, strErrMsg);
    
  }


  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // return { message: 'Go Serverless v1.0! Your function executed successfully!', event };
};
