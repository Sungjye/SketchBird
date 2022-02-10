//-------------------------------------------------------------------------------------
// Project: SketchBird
// DB: mysql.
// 
// 사용자의 데이터를 새롭게 생성하는 람다
//
// 
// 2021.07.28. sjjo. 새롭게 rds로.. 힘내자!
// 2021.08.09. sjjo. 인서트 하기전에, 기존에 존재하는지 먼저 확인. UserUid와 OriginSNS로만 일단.
// 2021.08.12. sjjo. JS와 협의해서, 다음과 같이 수정. 
//                   기존 사용자가 있으면(UserUid 와 OriginSNS로 확인), 
//                   사용자 정보 리턴, 없으면 insert 하고 UserIdx 리턴. 사용자가 로그인 할 때 사용. 
// 2021.08.17. sjjo. 코드 대정리. 
//                   사용자가 있으면 SELECT, 없으면 INSERT 쿼리 한번에 도저히 못하겠다. 
//                   Response 도 다르게 줘야 하니. 분리해서. 
//                   넘어온 UserUid와 OriginSNS에 해당하는 사용자가 있으면 전체정보 리턴.
//                   없으면 INSERT.
// 2021.09.14. sjjo. UserTable 에, userLanguage column 추가. 사용자가 사용하는 언어. 
//                   앱에서 쓰고, 서버에서 req, res 하는 JSON 형식에도 추가. 
//                   소문자로 바꾸기도 같이 정리함. DB에는 이미 바꿔놨네.
//                   gender insert 도 추가.
//
//-------------------------------------------------------------------------------------


'use strict';

const mysql = require('mysql');


const table_name = 'UserTable';

// 2021.08.09
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
          console.log("[CreateUser] [ERROR]: db-error:",err);
    });
    mysql_connection.end();
  });
}

/*
CREATE TABLE `UserTable` (
  `UserIdx` int unsigned NOT NULL AUTO_INCREMENT,
  `UserUid` varchar(45) NOT NULL,
  `FcmToken` tinytext NOT NULL,
  `NickName` varchar(45) NOT NULL,
  `AgeRange` int DEFAULT NULL,
  `Region` varchar(45) DEFAULT NULL,
  `AccepJorugi` tinyint NOT NULL,
  `AcceptRandom` tinyint NOT NULL,
  `IsBlockedUser` tinyint NOT NULL,
  `FunUserScore` int DEFAULT NULL,
  `GoldHandScore` int DEFAULT NULL,
  `UserLevel` int DEFAULT NULL,
  `OriginSNS` varchar(45) DEFAULT NULL,
  `SignedUpTime` datetime DEFAULT NULL,
  `Reporting` int DEFAULT NULL,
  `Reported` int DEFAULT NULL,
  `AgreeTerms` tinyint DEFAULT NULL,
  `UseSound` tinyint DEFAULT NULL,
  `UserLevelScore` int DEFAULT NULL,
  PRIMARY KEY (`UserIdx`),
  KEY `UserUid` (`UserUid`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8
*/

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

/*
// 람다에서 실행시키면, 역슬래쉬 붙는 거 없애기 위해. 
String.prototype.stripSlashes = function(){
  return this.replace(/\\(.)/mg, "$1");
};
// retrievedUserInfo.stripSlashes();  
*/

module.exports.CreateUser = async (event) => {

    
    try{

      //-------------------------------------------------------------------------
      // STEP 1. 쿼리 문을 만들고,
      //-------------------------------------------------------------------------
      var strQueryString = 'SELECT * FROM ' + table_name + ' ' 
                                + 'WHERE userUid=' + '\'' + event.userUid + '\' ' + 'AND '
                                      + 'originSNS=' + '\'' + event.originSNS + '\' '; // 스트링이라 '를 넣어줘야 쿼리됨! 
      //var strExistQueryString = 'SELECT EXISTS (' + strQueryString + ') AS isExist;';
      //var strExistQueryString = 'SELECT EXISTS (' + strQueryString + ');';
  
      //-------------------------------------------------------------------------
      // STEP 2. DB 접근하고,
      //-------------------------------------------------------------------------
      const mysqlResult = await queryThisFromTheTable(strQueryString);
  
      //const checkResult = mysqlResult[0].isExist;
      //console.log(strExistQueryString)
      //console.log(checkResult);
    
      //-------------------------------------------------------------------------
      // STEP 3. 넘어온 사용자가 있다는 가정하에 (대부분은 로그인 처리일것이므로)
      // 
      // 1 명이면, 정상 로그인 경우이므로 그 row 전체를 response.
      // 0 명이면, 신규 사용자 이므로, 넘어온 필수정보 몇가지를 체크해서 INSERT
      // 1 명 이상이면, 동일한 사용자가 1명이상 UserTable에 기록된 것이므로 심각한 에러로 리턴.
      //-------------------------------------------------------------------------
      const numOfUser = mysqlResult.length;
      //console.log('Num of the queried User(s):' + numOfUser);
      
      if( numOfUser == 1 )
      {

        var strOkMsg = "[CreateUser] [LOG IN: OK] Querying is done for this existing user: " + event.userUid 
                                                + ", originSNS: " + event.originSNS
                                                + ", userIdx: " + mysqlResult[0].userIdx;
        //-----------------------------------------
        // 사용자가 로그인할 때 마다 확인할거면, 이거 살리기.
        console.log(strOkMsg);

        //console.log('IDX: ' + mysqlResult[0].UserIdx );

        /* // 지우지 말것. 서버에서 실행, 역슬래쉬 이슈. 2021.08.17.
        var retrievedUserInfo = JSON.stringify(mysqlResult[0]);
        var retrievedUserInfo_woSlashs = retrievedUserInfo.stripSlashes();        

        console.log(mysqlResult[0]);
        console.log(retrievedUserInfo);
        console.log(retrievedUserInfo_woSlashs);
        */

        //return sendRes(201, JSON.stringify( mysqlResult[0]) ); // 서버에서 실행시키면 역슬래시 막나온다. 
        //return sendRes(201, retrievedUserInfo_woSlashs );
        //return JSON.stringify( mysqlResult[0]);
        //return mysqlResult[0];
        //return sendRes(201, '{' + mysqlResult[0] + '}');

        //var strtest = JSON.parse(mysqlResult[0]);
        //console.log(strtest);
        //var strtest2 = JSON.stringify(mysqlResult[0]);
        //console.log(strtest2);
        
        //return sendRes(201, mysqlResult[0] );
        //return sendRes(201, JSON.stringify(strtest) );

        return sendRes(201, mysqlResult[0] );

      
      }else if( numOfUser == 0 )
      {

        // 신규사용자 INSERT 하기. 
        if( (event.userUid == null) || (event.nickName == null) ) // 데이터 제대로 없이 (혹시나) 신규자용자로 넘어오면,
        {
          var strErrMsg = "[CreateUser] [Error] Not enough user information to crete this user. " + event.UserUid;
          console.log(strErrMsg);

          return sendRes(420, strErrMsg);
        }

        strQueryString ='INSERT INTO ' + table_name 
                    +'(' 
                    + 'userUid'
                    + ', fcmToken'
                    + ', nickName'
                    + ', ageRange'
                    + ', gender'
                    + ', region'
                    + ', userLanguage'
                    + ', accepJorugi'
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
                    + ', ' + event.accepJorugi
                    + ', ' + event.acceptRandom
                    + ', ' + event.isBlockedUser
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

  

          // 이제 DB에 INSERT
          try{

            const mysqlResult = await queryThisFromTheTable(strQueryString);

            console.log("[CreateUser] [OK] New User data is inserted. userUid: " + event.userUid 
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

            
            //return sendRes(200, JSON.stringify( {'UserIdx': mysqlResult.insertId} ) );
            return sendRes(200,  {"userIdx": mysqlResult.insertId} ); 
            

          }catch(error)
          {

            console.log("[CreateUser] [Error] INSERT FAIL. DB Access or etc.:  " + " > " + error);
            return sendRes(400, error);

          }


      }else
      {

        var strErrMsg = "[CreateUser] [Serious Error!!!] More than 1 User for userUid: " + event.userUid 
        + ", originSNS: " + event.originSNS;

        return sendRes(410, strErrMsg);

      }


          
  
    }catch(error){
      
      console.log("[CreateUser] [Error] SELECT FAIL. DB Access or etc.:  " + " > " + error);
      return sendRes(400, error);
  
    }

  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // return { message: 'Go Serverless v1.0! Your function executed successfully!', event };
};
