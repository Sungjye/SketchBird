//-------------------------------------------------------------------------------------
// Project: SketchBird
// DB: mysql.
// 
// 사용자의 데이터가 있는지 없는지 (sign up 되어 있는지) 확인하는 람다.
// CreateUser 람다에서, 
//      CheckUserInfo, InsertUserInfo, GetUserInfo 3개로 분리함. 
// 
// 2021.10.21. sjjo. Initial. CreateUser에서 코드가져와서 사용. 
// 
//-------------------------------------------------------------------------------------

'use strict';

const mysql = require('mysql');

const table_name = 'UserTable';

// 2021.10.21
const NOT_SIGNED_UP = 1;
const MORETHAN_ONE_USER = 2;

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
          console.log("[CheckUser] [ERROR]: db-error:",err);
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

// JY 의 고마운 feat! 2021.10.21
// https://dikshit18.medium.com/mapping-api-gateway-with-lambda-output-e8ea9e435bbf
const sendErr = (status, rcv_body) => {
  let response=null;


  // JY 의 고마운 feat! 2021.10.21
  response = {
    statusCode: status,
    body: rcv_body,
  };

  //console.log("THROW ERR in func");

  throw new Error(JSON.stringify(response));


}


module.exports.CheckUserInfo = async (event) => {

  //-------------------------------------------------------------------------
  // STEP 0. 기존에 사용자 있는지 조사할 최소한의 정보를 확인하고...
  //-------------------------------------------------------------------------
  if( (event.userUid == null) || (event.originSNS == null) )
  {
    const strInfoMsg = '[CheckUser] [Error] Null data!!!: userUid or originSNS. ' 
                          +'userUid: ' + event.userUid + ', originSNS: ' + event.originSNS;
    console.log(strInfoMsg);
    sendErr(402, strInfoMsg);

  }


  try{

      //-------------------------------------------------------------------------
      // STEP 1. 쿼리 문을 만들고,
      //-------------------------------------------------------------------------
      // 리퀘스트 받은 사용자가 있는지?

      var strQueryString = 'SELECT * FROM ' + table_name + ' ' 
                                      + 'WHERE userUid=' + '\'' + event.userUid + '\' ' + 'AND '
                                            + 'originSNS=' + '\'' + event.originSNS + '\' '; // 스트링이라 '를 넣어줘야 쿼리됨! 

      //-------------------------------------------------------------------------
      // STEP 2. DB 접근하고,
      //-------------------------------------------------------------------------
      const mysqlResult = await queryThisFromTheTable(strQueryString);

      //-------------------------------------------------------------------------
      // STEP 3. 넘어온 사용자의 수를 확인하고,
      //-------------------------------------------------------------------------
      const numOfUser = mysqlResult.length;
      //console.log('Num of the queried User(s):' + numOfUser);


      if( numOfUser == 1 )
      {
        /*
        var strOkMsg = "[CheckUser] [LOG IN: OK] Querying is done for this existing user: " + event.userUid 
                                                + ", originSNS: " + event.originSNS
                                                + ", userIdx: " + mysqlResult[0].userIdx;
        */
        //-----------------------------------------
        // 사용자가 로그인할 때 마다 확인할거면, 이거 살리기.
        //console.log(strOkMsg);

        const response = {
          userIdx: mysqlResult[0].userIdx, 
          userUid: event.userUid, 
          originSNS: event.originSNS
        }; 

        return sendRes(200, response );

      
      }else if( numOfUser == 0 )
      {

          //console.log("THROW ERR");
          // throw new Error(JSON.stringify(strInfoMsg));
          throw NOT_SIGNED_UP;
          //return sendRes(202, strInfoMsg);

      }else
      {
        /*
        var strErrMsg = "[CheckUser] [Serious Error!!!] More than 1 User for userUid: " + event.userUid 
        + ", originSNS: " + event.originSNS;

        return sendRes(410, strErrMsg);
        */
        throw MORETHAN_ONE_USER;

      }



  }catch(error)
  {
    let strInfoMsg = null;

      if( error == NOT_SIGNED_UP )
      {

        strInfoMsg = '[CheckUser] [Info] This user does not signed up! userUid: ' + event.userUid + ', originSNS: ' + event.originSNS;
        console.log(strInfoMsg);
        //sendErr(202, strInfoMsg);
        return sendErr(202, strInfoMsg);

      }else if( error == MORETHAN_ONE_USER )
      {
        strInfoMsg = '[CheckUser] [SriousError] More than 1 User for this userUid:' + event.userUid + ', originSNS: ' + event.originSNS;
        console.log(strInfoMsg);
        return sendErr(402, strInfoMsg);
      }else
      {

        //console.log("Genral Error...");
        strInfoMsg = "[CheckUser] [Error] SELECT FAIL. DB Access or etc.:  " + " > " + error;        
        console.log(strInfoMsg);
        return sendErr(400, strInfoMsg);

      }

  }


  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // return { message: 'Go Serverless v1.0! Your function executed successfully!', event };
};
