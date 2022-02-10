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
//-------------------------------------------------------------------------------------


'use strict';
const mysql = require('mysql');

const user_table = 'UserTable';
const localized_keyword_table = 'LocalizedKeywordTable';
const ketword_table = 'KeywordTable';

const NOT_ENOUGH_NUM_OF_KEYWORDS = 1;

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
          console.log("[GetKeyword] [ERROR]: db-error:",err);
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

// https://dikshit18.medium.com/mapping-api-gateway-with-lambda-output-e8ea9e435bbf
// feat. JY.
const sendErr = (status, rcv_body) => {
  let response=null;

  // 헤더도..잘 모르겠지만, 구색상 추가.. 
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

  //console.log("THROW ERR in func");

  throw new Error(JSON.stringify(response));

}


module.exports.GetKeyword = async (event) => {

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
      strInfoMsg = "[GetKeyword] [Error] 202. Not enough number of keywords according to its request. Req Lang: " + event.language + " Req num: " + event.num; 
      console.log(strInfoMsg);
      return sendErr(202, strInfoMsg);
    }else{
      strInfoMsg = "[GetKeyword] [Error] SELECT FAIL. DB Access or etc.:  " + " > " + error;
      console.log(strInfoMsg);
      return sendErr(400, strInfoMsg);      
    }
  }


  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // return { message: 'Go Serverless v1.0! Your function executed successfully!', event };
};
