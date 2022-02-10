//-------------------------------------------------------------------------------------
// Project: SketchBird
// DB: mysql.
// 
// 사용자인덱스+게임인덱스 조합으로 저장된
// 좋아요, 금손, 신고 의 상태를 가져오는 람다.
// 
// 2021.11.09. sjjo. TMLJ. ITIAC.
//
// 2021.11.11. sjjo. 쿼리 결과가 없으면 한번도 레이팅 안한것이므로, 
//                   에러가 아니라, 0 0 0 으로 리스폰스 해줘야. 
// 
// 2021.11.25. sjjo. 게임인덱스에 대한 카운트(스코어)값 6종 세트도 리스폰스 해줘야 한다. 
//                   일단은 더미로 주고, 추후 쿼리 예정. 
//                   (이제 이것만 단독으로 쓸지 안쓸지는 모르겠네...)
// 
//-------------------------------------------------------------------------------------
'use strict';

const mysql = require('mysql');


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
          console.log("[GetRatingStatus] [ERROR]: db-error:",err);
    });
    mysql_connection.end();
  });
}

//---------------------------------------------------------------------
// 표준 response 를 보내기 위해. + 에러 리스폰스 처리를 합침.
// : 기존 sendRes와 sendErr를 합침. 
//    * AWS Lambda 에 deploy 후에 실행시, response 에 \ 붙는 문제 해결 관련해서
//      body의 형식을 나눔. 정말 생고생했다.. 이런거 때매.. 
//    * error 를 쓰로우 해야, http response 가 해당 코드대로 제대로 간다 .
//    * feat. JY ref: https://dikshit18.medium.com/mapping-api-gateway-with-lambda-output-e8ea9e435bbf 
//---------------------------------------------------------------------
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


module.exports.GetRatingStatus = async (event) => {


  //-------------------------------------------------------------------------
  // 0. 리퀘스트 파라메터 중에 값이 널인것 있는지 체크.
  //
  //-------------------------------------------------------------------------
  if( (event.gameIdx==null) || (event.userIdx==null) )
  {
    const err_msg = "[GetRatingStatus] [Serious Error!!] Invalid Request Data! event: " + JSON.stringify(event);
    console.log( err_msg );
    return sendRes(402, err_msg);
  }

  const intGameIdx = event.gameIdx;
  const intUserIdx = event.userIdx;


  //-------------------------------------------------------------------------
  // 1. RatingStatusTable DB에서 레이팅 정보를 가져온다.
  //
  //-------------------------------------------------------------------------
  let queryResult = null; 

  try{

    const query_ratingStatusInfo = 'SELECT * FROM RatingStatusTable WHERE userIdx=' + intUserIdx + ' AND gameIdx=' + intGameIdx + ';';

    queryResult= await queryThisFromTheTable(query_ratingStatusInfo);

    //console.log(queryResult);
    //return sendRes(200, queryResult[0]);

  }catch(error)
  {
    const err_msg ="[GetRatingStatus] [Error] [RatingStatusTable] SELECT FAIL. DB Access or etc.: " 
                          + "event: " + JSON.stringify(event)
                          + " > " + error;
    console.log( err_msg );                    
    return sendRes(400, err_msg);
  }  

  //-------------------------------------------------------------------------
  // 2. 결과값이 단 1개가 아니면 문제가 있는 거임. 
  //   : 왜? 한사람과 한게임의 조합은 유일하므로. 
  // 
  //   아!! 쿼리 결과가 0 이면, 레이팅을 본인이 한번도 안한 게임에 대한 것이므로.. 
  //   그냥 다 0인 것으로 리턴해줘야 한다. 
  //   물론 있지도 않은 게임인덱스에, 있지도 않은 사용자인덱스가 아니라는 전제하.
  //-------------------------------------------------------------------------  
  if( queryResult.length == 1)
  {
    /*
    return sendRes(200, queryResult[0]);
    */
    const response_data = {
      userIdx: intUserIdx, 
      gameIdx: intGameIdx, 
      checkedFun: queryResult[0].checkedFun, 
      checkedGoldhand: queryResult[0].checkedGoldhand,
      checkedReport: queryResult[0].checkedReport,
      funScore: 7,
      goldHandScore: 7
    };

    /*
    리포트 당한 회수는 (부정적 이미지 이므로) 목록에서는 보여주지 않고, 게임 세부로 들어가면 보이게 하자. 

    그리고 리포트 한번 당한다고 리스트에서 노출되는것 날려버리면, 
    (장난 또는 의도적으로) 소중한 체인 리스트를 안보이게 해버리니, 리포트 회수가 1회있다고 노출 숨김 하는 것보다는, 
    신고되면 관리자가 보고 판단하거나, 5~10회정도가 어떨까.  (2021.11.25. 조)    
    */

    return sendRes(200, response_data);

  }else if( queryResult.length == 0 ) // 생각하보니, 게임인덱스를 없는걸 줬거나, 진행중인 게임의 인덱스를 주면 이렇게 0개 나온다. 
  {
    /*
    const response_data = {
      userIdx: intUserIdx, 
      gameIdx: intGameIdx, 
      checkedFun: 0, 
      checkedGoldhand: 0,
      checkedReport: 0
    };*/
    const response_data = {
      userIdx: intUserIdx, 
      gameIdx: intGameIdx, 
      checkedFun: 0, 
      checkedGoldhand: 0,
      checkedReport: 0,
      funScore: 14,
      goldHandScore: 14
    };

    return sendRes(200, response_data);

  }else 
  {
    const err_msg = "[GetRatingStatus] [Serious Error!!] There is no result. event: " + JSON.stringify(event);
    console.log( err_msg );
    return sendRes(410, err_msg);
  }

  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // return { message: 'Go Serverless v1.0! Your function executed successfully!', event };
};
