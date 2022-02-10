//-------------------------------------------------------------------------------------
// Project: SketchBird
// DB: mysql.
// 
// 사용자의 정보를 가져오는 람다
//
// 
// 2021.12.07. sjjo. Initial.
//                   : JY의 요청으로 pool 을 사용하는 버전으로 변경.                  
//                   : 도우심으로 진행한, GetMyTurnCountV2에서 가져옴.
//                   : 히스토리 보려면, Nov.2021 폴더에 get_userinfo 보기.
// 2021.12.24. sjjo. 202 스테터스 코드가 에러로 나오는 버그 해결. 
//                  
// 
//
//-------------------------------------------------------------------------------------
// References.
// 
// 
//-------------------------------------------------------------------------------------

'use strict';

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



async function queryThisFromTheTable( query_str ){
  return new Promise( (resolve, reject) => {

    pool.query(query_str, function(err, result, fields) {
      if(result)
      {
          resolve(result);
      }
      if(err)
      {
          const errMsg = "[GetUserInfoV2] [ERROR]: db-error:" + err;
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
      //if(status == 200)
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
      //if(status == 200)
      if( (status >= 200) && (status < 300) )
      {
        return response;
      }else
      {
        //throw new Error(response);
        throw new Error(JSON.stringify(response));
      }      
  }  
};

module.exports.GetUserInfoV2 = async (event) => {

  //-------------------------------------------------------------------------
  // STEP 0. 기존에 사용자 있는지 조사할 최소한의 정보를 확인하고...
  //-------------------------------------------------------------------------
  if( (event.userUid == null) || (event.originSNS == null) )
  {
    const strInfoMsg = '[GetUserInfoV2] [Error] Null data!!!: userUid or originSNS. ' 
                          +'userUid: ' + event.userUid + ', originSNS: ' + event.originSNS;
    console.log(strInfoMsg);
    return sendRes(402, strInfoMsg);

  }

  try{

      //-------------------------------------------------------------------------
      // STEP 1. 쿼리 문을 만들고,
      //-------------------------------------------------------------------------
      // 리퀘스트 받은 사용자가 있는지?

      var strQueryString = 'SELECT * FROM UserTable ' // + table_name + ' ' 
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
        var strOkMsg = "[GetUserInfo] [LOG IN: OK] Querying is done for this existing user: " + event.userUid 
                                                + ", originSNS: " + event.originSNS
                                                + ", userIdx: " + mysqlResult[0].userIdx;
        */
        //-----------------------------------------
        // 사용자가 로그인할 때 마다 확인할거면, 이거 살리기.
        //console.log(strOkMsg);
        /*
        const response = {
          userIdx: mysqlResult[0].userIdx, 
          userUid: event.userUid, 
          originSNS: event.originSNS
        };
        */ 

        return sendRes(200, mysqlResult[0] );

      
      }else if( numOfUser == 0 )
      {

          //console.log("THROW ERR");
          // throw new Error(JSON.stringify(strInfoMsg));
          throw NOT_SIGNED_UP;
          //return sendRes(202, strInfoMsg);

      }else
      {
        /*
        var strErrMsg = "[GetUserInfo] [Serious Error!!!] More than 1 User for userUid: " + event.userUid 
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

        strInfoMsg = '[GetUserInfoV2] [Info] This user does not signed up! userUid: ' + event.userUid + ', originSNS: ' + event.originSNS;
        console.log(strInfoMsg);
        return sendRes(202, strInfoMsg);

      }else if( error == MORETHAN_ONE_USER )
      {
        strInfoMsg = '[GetUserInfoV2] [SriousError] More than 1 User for this userUid:' + event.userUid + ', originSNS: ' + event.originSNS;
        console.log(strInfoMsg);
        return sendRes(402, strInfoMsg);
      }else
      {

        //console.log("Genral Error...");
        strInfoMsg = "[GetUserInfoV2] [Error] SELECT FAIL. DB Access or etc.:  " + " > " + error;        
        console.log(strInfoMsg);
        return sendRes(400, strInfoMsg);

      }

  }



  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // return { message: 'Go Serverless v1.0! Your function executed successfully!', event };
};
