'use strict';


const mysql = require('mysql');


// MYSQL 테이블에서 데이터를 5개 조회하는 예제
function getCommentByDB() {
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
    //'select id, hit from posts where subject="aaa"'
    mysql_connection.query('select * from posts', function(err, result, field) {
        if(result)
          resolve(result);
        
        if(err)
          console.log("db-error:",err);
    });
    mysql_connection.end();
  });
}


module.exports.sjabc = async (event) => {


  const mysqlResult = await getCommentByDB();
  //console.log(mysqlResult.)
  console.log(mysqlResult);

  return {
    statusCode: 200,
    body: JSON.stringify(
      {
        message: 'MySql Test. Serverless v1.0! Your function executed successfully!',
        input: event,
        result: mysqlResult,
      },
      null,
      2
    ),
  };

  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // return { message: 'Go Serverless v1.0! Your function executed successfully!', event };
};
