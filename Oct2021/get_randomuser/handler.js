//-------------------------------------------------------------------------------------
// Project: SketchBird
// DB: mysql.
// 
// 랜덤하게 사용자 한명을 구하는 람다. 
//
// 
// 2021.10.07. sjjo. Oh, MLJPHM PHMICFY
// 
// 2021.10.27. sjjo. http response code 를 제대로 보내기 위한 리스폰스 코드 추가 및 변경
//                   헐 이렇게 복잡한걸 짰다니.. 케이스 고려도 잘했네.. 역시 그분의 도우심.
//
//-------------------------------------------------------------------------------------

'use strict';

const mysql = require('mysql');
const { send } = require('process');


// 2021.10.27
const ERR_NO_RANDOM_USER = 1;
const ERR_NO_LANG_RANDOM_USER = 2; // 그 언어를 사용하는 랜덤유저 없음.
const ERR_TIMEOUT = 3; // 나중에 구현할 필요있을려나, 할 수 있을려나. 

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
          console.log("[GetRandomuser] [ERROR]: db-error:",err);
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

// JY 의 고마운 feat! 2021.10.21
// https://dikshit18.medium.com/mapping-api-gateway-with-lambda-output-e8ea9e435bbf
const sendErr = (status, rcv_body) => {
  let response=null;

  response = {
    statusCode: status,
    body: rcv_body,
  };


  throw new Error(JSON.stringify(response));

}

module.exports.GetRandomuser = async (event) => {



  const strDrawType = event.type;
  const strUserLanguage = event.userLanguage;

  let queryResult = null;

  //-----------------------------------------------------------------
  // '그림'을 그렸다면, 언어상관없이 아무나 랜덤으로 골라서 리스폰스.
  //-----------------------------------------------------------------
  if( strDrawType == 'draw' ) 
  {

    try{
      // Ref. 10만 유저에서도 잘?! 동작하는 쿼리. 
      // https://stackoverflow.com/questions/4329396/mysql-select-10-random-rows-from-600k-rows-fast
      /*
      SELECT userName
      FROM RandTest AS r1 JOIN
          (SELECT CEIL(RAND() *
                        (SELECT MAX(userIdx)
                            FROM RandTest)) AS userIdx)
              AS r2
      WHERE r1.userIdx >= r2.userIdx AND r1.acceptRandom = 1
      ORDER BY r1.userIdx ASC
      LIMIT 1
      */
      const query_randomUser = 'SELECT r1.userIdx, r1.userUid '
                                + 'FROM UserTable AS r1 JOIN '
                                   + '(SELECT CEIL(RAND() * '
                                                + '(SELECT MAX(userIdx) '
                                                        + 'FROM UserTable)) AS userIdx) '
                                  + 'AS r2 '
                                + 'WHERE r1.userIdx >= r2.userIdx AND r1.acceptRandom = 1 '
                                + 'LIMIT 1;';


      queryResult = await queryThisFromTheTable(query_randomUser);

      // 예외 처리. 얻어온 사용자가 1명이 아닐경우. (0명일 경우.)
      if( queryResult.length != 1 ) 
      {
        //const err_msg = "[GetRandomuser] [Error] [UserTable] There is no random user! numOfUser: " + queryResult.length ;
        //console.log( err_msg );
        //return sendRes(406, err_msg);
        throw ERR_NO_RANDOM_USER;
      }

      const returnBody = { 
        id: queryResult[0].userUid,
        userIdx: queryResult[0].userIdx
      };

      return sendRes( 200, returnBody );

    }catch(error)
    {
      //console.log("[GetRandomuser] [Error] [UserTable] SELECT FAIL. DB Access or.. : " + " > " + error);
      //return sendRes(400, error);

      let strErrMsg = null;

      if( error == ERR_NO_RANDOM_USER )
      {
        strErrMsg = "[GetRandomuser] [Error] [UserTable] There is no random user!";
        console.log(strErrMsg);
        return sendErr(406, strErrMsg);

      }else
      {
        strErrMsg = "[GetRandomuser] [Error] [UserTable] SELECT FAIL. DB Access or.. : " + " > " + error;
        console.log(strErrMsg);
        return sendErr(400, strErrMsg);

      }

    }

  }else
  {
  //--------------------------------------------------------------------------------------------------
  // '글자'를 그렸다면, 해당 사용자의 언어와 동일한 언어가 설정된 사용자 중에서 랜덤으로 골라서 리스폰스. 
  //--------------------------------------------------------------------------------------------------
  // TBD. 언어 여러개 놓고, 테스트 해서 확인해 해야 함. 2021.10.07


    try{

      const query_randomUserByLang = 'SELECT r1.userIdx, r1.userUid '
                                + 'FROM UserTable AS r1 JOIN '
                                   + '(SELECT CEIL(RAND() * '
                                                + '(SELECT MAX(userIdx) '
                                                        + 'FROM UserTable)) AS userIdx) '
                                  + 'AS r2 '
                                + 'WHERE r1.userIdx >= r2.userIdx AND r1.acceptRandom = 1 '
                                                             + 'AND r1.userLanguage = ' + '\'' + strUserLanguage + '\' '
                                + 'LIMIT 1;';


      queryResult = await queryThisFromTheTable(query_randomUserByLang);

      // 예외 처리. 얻어온 사용자가 1명이 아닐경우. (0명일 경우.)
      if( queryResult.length != 1 ) 
      {
        //const err_msg = "[GetRandomuser] [Error] [UserTable] There is no random user with this language: " + strUserLanguage ;
        //console.log( err_msg );
        //return sendRes(412, err_msg);

        throw ERR_NO_LANG_RANDOM_USER;
      }

      const returnBody = { 
        id: queryResult[0].userUid,
        userIdx: queryResult[0].userIdx
      };

      return sendRes( 200, returnBody );

    }catch(error)
    {
      //console.log("[GetRandomuser] [Error] [UserTable] SELECT FAIL. DB Access or.. : " + " > " + error);
      //return sendRes(400, error);
      let strErrMsg = null;

      if( error == ERR_NO_LANG_RANDOM_USER )
      {
        strErrMsg = "[GetRandomuser] [Error] [UserTable] There is no random user with this language: " + event.userLanguage ;
        console.log(strErrMsg);
        return sendErr(412, strErrMsg);

      }else
      {
        strErrMsg = "[GetRandomuser] [Error] [UserTable] SELECT FAIL. DB Access or.. : " + " > " + error;
        console.log(strErrMsg);
        return sendErr(400, strErrMsg);

      }
      
    }


  }


};
