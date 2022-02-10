//-------------------------------------------------------------------------------------
// Project: SketchBird
// DB: mysql.
// 
// 제시어(키워드)를 랜덤하게 얻어오는 람다
//
// 
// 2021.08.19. sjjo. JY가 쿼리문 만들어 줄테니! 영차해서 JS와 mysql 기반 toss game 해보자~ d
//                   올.. 30분 만에 끝. 테스트 까지. 
// 2021.09.14. sjjo. 컬럼 및 필드의 대문자 소문자 수정. 아니네. 키워드 쪽은 테이블 컬럼 아직 대문자. 
//                   일단 두자. 내가 리스폰스만 소문자로 해주면 될듯.
//                   바꾸자. 받은거 그대로 리스폰스 하려면.
//                   * 영어 선택인 경우, 쿼리문을 별도로 만들어줌.
// 2021.10.21. sjjo. http response code 를 제대로 보내기 위한 리스폰스 코드 추가 및 변경.
// 2021.10.27. sjjo. 위의 내용 마무리 및 확인. 
//
// 2021.12.28. sjjo. mysql2 pool 쓰는 버전으로 변경. 역사나 가끔 에러가나서 일단 바꾸기.
// 
//-------------------------------------------------------------------------------------
'use strict';

'use strict';

const NOT_ENOUGH_NUM_OF_KEYWORDS = 1;

// 로그 안 찍히게 하기. 
console.logDebug = function() {};

/*
// 로그 찍히게 하기.
var log = console.log;
console.logDebug = function() {
  log.apply(console, arguments);
  // Print the stack trace
  //console.trace();
};
*/


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
          const errMsg = "[GetKeywordV2] [ERROR]: db-error:" + err;
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



module.exports.GetKeywordV2 = async (event) => {

  try{

    //-------------------------------------------------------------------------
    // STEP 1. 쿼리 문을 만들고, 
    // 단! 넘어온 언어선택이 영어이면 그냥 테이블 하나만 조회해도 된다. 2021.09.14
    //-------------------------------------------------------------------------
    /*
  SELECT K.KeywordIdx, L.LocalizedIdx, Keyword, Lang, LocalizedKeyword
	FROM sketchbird.KeywordTable AS K
	INNER JOIN sketchbird.LocalizedKeywordTable AS L
    ON K.KeywordIdx = L.KeywordIdx
    WHERE L.Lang = “kr” ORDER BY RAND() LIMIT 3    
    */
    /*var strQueryString = 'SELECT * FROM ' + table_name + ' ' 
                              + 'WHERE UserUid=' + '\'' + event.UserUid + '\' ' + 'AND '
                                    + 'OriginSNS=' + '\'' + event.OriginSNS + '\' '; // 스트링이라 '를 넣어줘야 쿼리됨! 
    */              
    
    let getKeywordQueryString = null;

    /*
    if( event.language == 'en' )
    {
      getKeywordQueryString = 'SELECT keywordIdx, keyword FROM KeywordTable' 
                                + ' ORDER BY RAND() LIMIT ' + event.num;
    }else
    { 
        getKeywordQueryString = 'SELECT K.keywordIdx, L.localizedIdx, keyword, lang, localizedKeyword'
                                + ' FROM KeywordTable AS K'
                                + ' INNER JOIN LocalizedKeywordTable AS L'
                                + ' ON K.keywordIdx = L.keywordIdx'
                                + ' WHERE L.lang = ' + '\'' + event.language + '\''
                                + ' ORDER BY RAND() LIMIT ' + event.num;
                                //+ ' ORDER BY RAND() LIMIT 1'; // unity 연동 위한 테스트. 2021.08.24
    }
    */

    // LocalizedKeywordTable에, 'en' 도 localized 된 언어의 하나로 추가했음. GetGameInfo 람다에서, 한번에 쿼리 하려고. 
    getKeywordQueryString = 'SELECT K.keywordIdx, L.localizedIdx, keyword, lang, localizedKeyword'
                              + ' FROM KeywordTable AS K'
                              + ' INNER JOIN LocalizedKeywordTable AS L'
                              + ' ON K.keywordIdx = L.keywordIdx'
                              + ' WHERE L.lang = ' + '\'' + event.language + '\''
                              + ' ORDER BY RAND() LIMIT ' + event.num;
                              //+ ' ORDER BY RAND() LIMIT 1'; // unity 연동 위한 테스트. 2021.08.24


    //console.log(getKeywordQueryString);
    //-------------------------------------------------------------------------
    // STEP 2. DB 접근하고,
    //-------------------------------------------------------------------------
    const mysqlResult = await queryThisFromTheTable(getKeywordQueryString);


    //console.log(mysqlResult);
    //console.log(mysqlResult.length);
    if( mysqlResult.length == event.num )
    {
      return sendRes(200, mysqlResult);
    }else
    {
      // 해당 요청 언어의 대한 키워드가 없거나 요청한 개수 이하임. 
      //return sendRes(202, mysqlResult);      

      // 2021.10.27
      throw NOT_ENOUGH_NUM_OF_KEYWORDS
    }

    

  }catch(error)
  {
    let strInfoMsg = null;
    // 2021.10.27
    if( error == NOT_ENOUGH_NUM_OF_KEYWORDS )
    {
      strInfoMsg = "[GetKeywordV2] [Error] 202. Not enough number of keywords according to its request. Req Lang: " + event.language + " Req num: " + event.num; 
      console.log(strInfoMsg);
      return sendRes(202, strInfoMsg);
    }else{
      strInfoMsg = "[GetKeywordV2] [Error] SELECT FAIL. DB Access or etc.:  " + " > " + error;
      console.log(strInfoMsg);
      return sendRes(400, strInfoMsg);      
    }
  }


  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // return { message: 'Go Serverless v1.0! Your function executed successfully!', event };
};
