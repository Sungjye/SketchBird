'use strict';

module.exports.TestHttpResponse = async (event) => {


  /* The original code
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

  const response = {
      statusCode: 202,
      body: 'Hello! Http Responses! 202',
  };

  throw new Error(JSON.stringify(response));

  //return response; // Dont throw error in case of 200

  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // return { message: 'Go Serverless v1.0! Your function executed successfully!', event };
};
