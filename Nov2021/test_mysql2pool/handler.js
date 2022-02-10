
// References
// https://cotak.tistory.com/104 
// https://www.npmjs.com/package/mysql2

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




async function queryTest( query_str ){
  return new Promise( (resolve, reject) => {

    pool.query(query_str, function(err, result, fields) {
      if(result)
      {
          resolve(result);
      }
      if(err)
      {
          const errMsg = "[TestMysql2Pool] [ERROR]: db-error:" + err;
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

module.exports.TestMysql2Pool = async (event) => {


//=======================================
// 2021.11.25 
// mysql 단순 커넥션하니 요청수가 많이지면 문제가 생겨서, 
// pool 을 사용한 것 JY가 찾아줘서 천천히 테스트 해본다.
// 
// https://www.npmjs.com/package/mysql2 이 레퍼런스 따라서. 
// 
//=======================================

//---------------------------------------
// Step 1: 그냥 바로 해보는 첫쿼리.
//---------------------------------------
/*
// create the connection to database
const connection = mysql.createConnection({
  host: 'sketchbird-01.c8wfnhiunwfj.ap-northeast-2.rds.amazonaws.com',
  port: 3306,
  user: 'sketchbirddb',
  password: 'coglix!!..',
  database: 'sketchbird'
});

// simple query
connection.query(
  'SELECT gameIdx FROM GameCurrentTable WHERE nextUserIdx=1;',
  function(err, results, fields) {
    console.log(results); // results contains rows returned by server
    console.log(fields); // fields contains extra meta data about results, if available
  }
);
*/

//---------------------------------------
// Step 2: Using connection pools : 커넥션 풀사용해 봐유
//---------------------------------------

// Create the connection pool. The pool-specific settings are the defaults
/*
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
*/

// - - - - - - - - - -
// Step 2-1 : 첫번째 안.

/*
// For pool initialization, see above
pool.query("SELECT gameIdx FROM GameCurrentTable WHERE nextUserIdx=1;", function(err, rows, fields) {
    // Connection is automatically released when query resolves
    console.log(rows); // results contains rows returned by server
    //console.log(fields); // fields contains extra meta data about results, if available
});
*/

// - - - - - - - - - -
// Step 2-2 : 두번째 안.
/*
// For pool initialization, see above
pool.getConnection(function(err, conn) {
  // Do something with the connection
  conn.query("SELECT gameIdx FROM GameCurrentTable WHERE nextUserIdx=1;", function(err, rows, fields) {
    // Connection is automatically released when query resolves
    console.log("get connection");
    console.log(rows); // results contains rows returned by server
    //console.log(fields); // fields contains extra meta data about results, if available
});
  // Don't forget to release the connection when finished!
  pool.releaseConnection(conn);
}) 
*/

//---------------------------------------
// Step 3: Using Promise Wrapper : 프라미쓰!
//---------------------------------------

// 여기서부터 다시 해보자. 
// https://www.npmjs.com/package/mysql2

// 2021.11.30.
// 주시는 마음을 따라, 이것 찬찬히 읽고, 크롬에서 따라 해보고 다시 돌아왔다. 
// https://programmingsummaries.tistory.com/325
// 
// 다시 이것부터. 
// https://www.npmjs.com/package/mysql2 
// 에서 유징 프라미스 뤠퍼. 
// 블루버드 뭔지 알겠고, (좋은 프라미스 라이브러리)
// the third paragraph code.
//const promisePool = pool.promise(); // 이제, 좀전에 크리에잇한 풀에서, 한개의 Promised wrapped instance 를 가져온다. 
//const [rows,fields] = await promisePool.query("SELECT gameIdx FROM GameCurrentTable WHERE nextUserIdx=1;");


  //-------------------------------------------------------------------------
  // 0. 리퀘스트 파라메터 중에 값이 널인것 있는지 체크.
  //
  //-------------------------------------------------------------------------
  if( (event.userIdx==null) )
  {
    const err_msg = "[TestMysql2Pool] [Serious Error!!] Invalid Request Data! event: " + JSON.stringify(event);
    console.log( err_msg );
    return sendRes(402, err_msg);
  }

  // 리퀘스트온 사용자의 idx를 저장하고, (가독성과 사용의 편리를 위해)
  const intUserIdx = event.userIdx;
  var queryResult = null; 

try{
    const testStr = "SELECT gameIdx FROM GameCurrentTable WHERE nextUserIdx=" + intUserIdx + ';';
    queryResult = await queryTest(testStr);

    const intResultNum = queryResult.length;


    const return_body = {
      userIdx: intUserIdx, 
      numOfGames: intResultNum
    };

    // 그냥 리스폰스 일원화.
    return sendRes(200, return_body);

  }catch(error)
  {
    console.log("[TestMysql2Pool] [Error] SELECT FAIL. DB Access or etc.:  " + " > " + error);
    return sendRes(400, error);
  }


// 일단 이건 썩세스 떨어지는데.. 2021.11.25
// https://cotak.tistory.com/104 여기서 코드 참조. 
/*
const connection = await pool.getConnection(async conn => conn); 

try { 
  await connection.beginTransaction(); 
  await connection.query("SELECT gameIdx FROM GameCurrentTable WHERE nextUserIdx=1;"); 
  await connection.commit(); 
  console.log('success!'); 

} catch (err) { 
  await connection.rollback(); 
  throw err; 

} finally { 
  connection.release(); 
}


return;
*/


/*
  return {
    statusCode: 200,
    body: JSON.stringify(
      {
        message: 'Go Serverless v1.0! Your function executed successfully!',
        input: event,
      },
      null,
      2
    ),
  };
*/
  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // return { message: 'Go Serverless v1.0! Your function executed successfully!', event };
};
