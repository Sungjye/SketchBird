//-------------------------------------------------------------------------------------
// Project: SketchBird
// DB: mysql.
// 
// 사용자의 데이터를 인서트 하는 람다.
// CreateUser 람다에서, 
//      CheckUserInfo, InsertUserInfo, GetUserInfo 3개로 분리함. 
// 
// 2021.10.21. sjjo. Initial. CreateUser에서 코드가져와서 사용. 
// 2021.10.21. sjjo. 억셉트 조르기 스펠 틀린것 수정.
// 
// 2021.11.02. sjjo. UserTable에 sns오리진 null 이 있는 것을 보고. 
//                   최소한의 event 정보중에,  sns오리진이 null이면 에러 리스폰스하는 것 추가!!
// 
//-------------------------------------------------------------------------------------

'use strict';

const mysql = require('mysql');

const table_name = 'UserTable';

// 2021.10.21
const USER_EXIST = 0;
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
          console.log("[InsertUserInfo] [ERROR]: db-error:",err);
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


module.exports.InsertUserInfo = async (event) => {

  //-------------------------------------------------------------------------
  // STEP 0. 기존에 사용자 있는지 조사할 최소한의 정보를 확인하고...
  //-------------------------------------------------------------------------
  if( (event.userUid == null) || (event.originSNS == null) )
  {
    const strInfoMsg = '[InsertUserInfo] [Error] Null data!!!: userUid or originSNS. ' 
                          +'userUid: ' + event.userUid + ', originSNS: ' + event.originSNS;
    console.log(strInfoMsg);
    sendErr(402, strInfoMsg);

  }


  try{

      //-------------------------------------------------------------------------
      // STEP 1. 쿼리 문을 만들고,
      //-------------------------------------------------------------------------
      // 리퀘스트 받은 사용자가 있는지?

      var strQueryString = 'SELECT userIdx FROM ' + table_name + ' ' 
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
        var strOkMsg = "[InsertUserInfo] [LOG IN: OK] Querying is done for this existing user: " + event.userUid 
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

        //return sendRes(200, mysqlResult[0] );
        throw USER_EXIST;

      
      }else if( numOfUser == 0 )
      {

          //console.log("THROW ERR");
          // throw new Error(JSON.stringify(strInfoMsg));
          //throw NOT_SIGNED_UP;
          //return sendRes(202, strInfoMsg);
          
          // 인서트 람다에서는 이게 정상. 다음 인서트 쿼리로 넘어감. 2021.10.21

          ;

      }else
      {
        /*
        var strErrMsg = "[CreateUser] [Serious Error!!!] More than 1 User for userUid: " + event.userUid 
        + ", originSNS: " + event.originSNS;

        return sendRes(410, strErrMsg);
        */
        throw MORETHAN_ONE_USER;

      }



  }catch(error)
  {
    let strInfoMsg = null;

      if( error == USER_EXIST )
      {

        strInfoMsg = '[InsertUserInfo] [Info] This user is already exist! userUid: ' + event.userUid + ', originSNS: ' + event.originSNS;
        console.log(strInfoMsg);
        sendErr(201, strInfoMsg);

      }else if( error == MORETHAN_ONE_USER )
      {
        strInfoMsg = '[InsertUserInfo] [SriousError] More than 1 User for this userUid:' + event.userUid ;
        console.log(strInfoMsg);
        sendErr(402, strInfoMsg);
      }else
      {

        //console.log("Genral Error...");
        strInfoMsg = "[InsertUserInfo] [Error] SELECT FAIL. DB Access or etc.:  " + " > " + error;        
        console.log(strInfoMsg);
        sendErr(400, strInfoMsg);

      }

  }


  //-------------------------------------------------------------------------
  // STEP 4. 이제 인서트해야 하는데, 충분한?! 정보가 있는지 확인하고...
  //-------------------------------------------------------------------------
  if( (event.userUid == null) || (event.nickName == null) )
  {
    const strInfoMsg = '[InsertUserInfo] [Error] Not sufficient user infomation to INSERT! ' + event.userUid + ', originSNS: ' + event.originSNS ;
    console.log(strInfoMsg);
    sendErr(402, strInfoMsg);

  }

  //-------------------------------------------------------------------------
  // STEP 5. 이제 인서트 하면 됨. 
  //-------------------------------------------------------------------------
  //console.log("OK");

  
  try{

    const intBlockedUserDefault = 0;

      strQueryString ='INSERT INTO ' + table_name 
      +'(' 
      + 'userUid'
      + ', fcmToken'
      + ', nickName'
      + ', ageRange'
      + ', gender'
      + ', region'
      + ', userLanguage'
      + ', acceptJorugi'
      + ', acceptRandom'
      + ', isBlockedUser'
      + ', funUserScore'
      + ', goldHandScore'
      + ', userLevel'
      + ', originSNS'
      + ', signedUpTime'
      + ', reporting'
      + ', reported'
      + ', agreeTerms'
      + ', useSound'
      + ', userLevelScore'
      + ') '

      +'VALUES (' 
      +        '\'' + event.userUid + '\''
      + ', \'' + event.fcmToken + '\''
      + ', \'' + event.nickName + '\''
      + ', ' + event.ageRange
      + ', ' + event.gender
      + ', \'' + event.region + '\''
      + ', \'' + event.userLanguage + '\''
      + ', ' + event.acceptJorugi
      + ', ' + event.acceptRandom
      + ', ' + intBlockedUserDefault
      + ', ' + event.funUserScore
      + ', ' + event.goldHandScore
      + ', ' + event.userLevel
      + ', \'' + event.originSNS + '\''
      + ', Now()' 
      + ', ' + event.reporting
      + ', ' + event.reported
      + ', ' + event.agreeTerms
      + ', ' + event.useSound
      + ', ' + event.userLevelScore
      + ');' ;

      const mysqlResult = await queryThisFromTheTable(strQueryString);

      console.log("[InsertUserInfo] [OK] New User data is inserted. userUid: " + event.userUid 
                                                        + ", originSNS: " + event.originSNS
                                                        + ", INSERTED userIdx: " + mysqlResult.insertId);
      
      /* 지우지 말것. 
      console.log(mysqlResult);
      OkPacket {
        fieldCount: 0,
        affectedRows: 1,
        insertId: 7,
        serverStatus: 2,
        warningCount: 0,
        message: '',
        protocol41: true,
        changedRows: 0
      }

      //console.log(mysqlResult[0].UserIdx );
      //console.log(mysqlResult.UserIdx );
      //console.log(mysqlResult.insertId);
      */

      const response = {
        userIdx: mysqlResult[0].insertId, 
        userUid: event.userUid, 
        originSNS: event.originSNS
      }; 

      return sendRes(200, response );



  }catch(error)
  {
    strInfoMsg = "[InsertUserInfo] [Error] DB INSERT FAIL. DB Access or etc.:  " + " > " + error;        
    console.log(strInfoMsg);
    sendErr(400, strInfoMsg);
  }


  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // return { message: 'Go Serverless v1.0! Your function executed successfully!', event };
};
