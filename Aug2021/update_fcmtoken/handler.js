//-------------------------------------------------------------------------------------
// Project: SketchBird
// DB: mysql.
// 
// 사용자의 UserUid 에 해당하는 FCM Token 을 업데이트 하는 람다
// 주로 로그인 직후 앱에 의해 호출될 듯?
//
// 
// 2021.08.09. sjjo. Initial.
// 2021.09.14. sjjo. 이 람다가 호출되는 가정은, 이미 사용자가 있다는 가정하에서 호출. 
//                   즉, update를 바로하고, 만약, 실패하면 그 결과를 분류해서 리턴해주기. 
//                   이렇게 하도록 대변경. 
//
//-------------------------------------------------------------------------------------
'use strict';

const mysql = require('mysql');
const table_name = 'UserTable';

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
    //'select id, hit from posts where subject="aaa"'
    // 'select * from posts'
    mysql_connection.query(query_string, function(err, result, field) {
        if(result)
          resolve(result);
        
        if(err)
          console.log("[UpdateFcmToken] [ERROR]: db-error:",err);
    });
    mysql_connection.end();
  });
}

const isLocal = 0; // 아직 로컬 실행인지 확인하는 방법 모르겠다. 
//---------------------------------
// 표준 response 를 보내기 위해. 
// AWS Lambda 에 deploy 후에 실행시, response 에 \ 붙는 문제 해결 관련해서
// body의 형식을 나눔. 정말 생고생했다.. 이런거 때매.. 
// 
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


module.exports.UpdateFcmToken = async (event) => {

  //-------------------------------------------------------------------------
  // STEP 1. 바로 업데이트 시도. 이미 사용자는 있다는 가정하에. 
  //         나머지 사용자 정보도 없는데, fcm token만 insert 하는 경우는 불가능함.

  try{

    var strUpdateQuery = 'UPDATE ' + table_name + ' SET fcmToken=\'' + event.fcmToken + '\' ' 
                                      + 'WHERE userUid=\'' + event.userUid + '\';';

    const updateResult = await queryThisFromTheTable(strUpdateQuery);

    //var strMsg = "[UpdateFcmToken] FCM Token is updated for userUid: " + event.userUid; 
    //console.log(strMsg);
    //console.log(updateResult);

    // 2021.08.19
    if(updateResult.affectedRows==1 && updateResult.warningCount==0 )
    {
      // 정상적으로 update 된 경우.
      //return sendRes(200, JSON.stringify(strMsg) );
      return sendRes( 200, {"userUid": event.userUid } );
    }else
    {
      // 업데이트 된 row가 없거나 warning 이 있는 경우. 
      console.log("[UpdateFcmToken] FCM Token is not updated for userUid: " + event.userUid );
      console.log("[UpdateFcmToken] There are some warning: " + updateResult.message);
      //return sendRes( 201, {"userUid": event.userUid } );
      //return sendRes( 410, {"No userUid": event.userUid } );
      return sendRes( 410, updateResult.message );

    }

  }catch(error){

    console.log("[UpdateFcmToken] [Error][DB access Failed]: " + " > " + error);
    return sendRes(400, error);

  }

  //-------------------------------------------------------------------------
  // STEP 2. 업데이트 결과, 사용자가 없거나 하면 에러를 리턴. 



/*
  //-------------------------------------------------------------------------
  // STEP 1. 기존에 이 사용자의 정보가 존재하는지 확인!
  //         있어야 update 를 하지. 
  try{

    var strQueryString = 'SELECT UserIdx FROM ' + table_name + ' ' 
                              + 'WHERE UserUid=' + '\'' + event.UserUid + '\' '; 
    var strExistQueryString = 'SELECT EXISTS (' + strQueryString + ') AS isExist;';

    const mysqlResult = await queryThisFromTheTable(strExistQueryString);

    const checkResult = mysqlResult[0].isExist;
    //console.log(strExistQueryString)
    //console.log(checkResult);

    if( checkResult ) // 기존에 있다면!
    {
      ; // 있다면 계속 진행.
      //var strMsg = "It Exists! :" + event.UserUid;
      //return sendRes(200, JSON.stringify(strMsg) );


    }else // 없다면 에러!
    {

      var strErrMsg = "[UpdateFcmToken] [Error][Update Failed]:  " + " > " 
                + "UserUid is NOT exists! UserUid: " + event.UserUid;
      
      return sendRes(410, JSON.stringify(strErrMsg) );

    } 

  }catch(error){
    
    console.log("[UpdateFcmToken] [Error][DB row exist checking is Failed]:  " + " > " + error);
    return sendRes(420, error);

  }


  //-------------------------------------------------------------------------
  // STEP 2. 있는 사용자 라야, FCM Token 을 update 하지. 
  try{

    var strUpdateQuery = 'UPDATE ' + table_name + ' SET FcmToken=\'' + event.FcmToken + '\' ' 
                                      + 'WHERE UserUid=\'' + event.UserUid + '\';';

    const updateResult = await queryThisFromTheTable(strUpdateQuery);

    var strMsg = "[UpdateFcmToken] FCM Token is updated for UserUid: " + event.UserUid; 
    console.log(strMsg);
    //console.log(updateResult);

    // 2021.08.19
    if(updateResult.affectedRows==1 && updateResult.warningCount==0 )
    {
      // 정상적으로 update 된 경우.
      //return sendRes(200, JSON.stringify(strMsg) );
      return sendRes( 200, {"UserUid": event.UserUid } );
    }else
    {
      // 업데이트 된 row가 없거나 warning 이 있는 경우. 
      console.log("[UpdateFcmToken] FCM Token is not updated for UserUid: " + event.UserUid );
      console.log("[UpdateFcmToken] There are some warning: " + updateResult.message);
      return sendRes( 201, {"UserUid": event.UserUid } );

    }

  }catch(error){

    console.log("[UpdateFcmToken] [Error][DB access Failed]: " + " > " + error);
    return sendRes(400, error);

  }
  */


  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // return { message: 'Go Serverless v1.0! Your function executed successfully!', event };
};
