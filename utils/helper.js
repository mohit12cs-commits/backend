const fs = require("fs");
const { asyncHandler } = require("./asyncHandler");
const jwt = require('jsonwebtoken');


module.exports = {

  getRandomNumber: (max) => {
    return Math.floor(Math.random() * max);
  },

  getPaginatedPayload: (dataArray, page, perPage) => {
    const startPosition = +(page - 1) * perPage;

    const totalItems = dataArray.length; // total documents present after applying search query
    const pagination = Math.ceil(totalItems / perPage);

    dataArray = structuredClone(dataArray).slice(
      startPosition,
      startPosition + perPage
    );

    const payload = {
      page,
      perPage,
      pagination,
      previousPage: page > 1,
      nextPage: page < totalPages,
      totalItems,
      currentPageItems: dataArray?.length,
      data: dataArray,
    };
    return payload;
  },

  getStaticFilePath: (req, fileName) => {
    return `${req.protocol}://${req.get("host")}/images/${fileName}`;
  },

  getLocalPath: (fileName) => {
    return `public/images/${fileName}`;
  },

  removeLocalFile: (localPath) => {
    fs.unlink(localPath, (err) => {
      if (err) console.log("Error while removing local files: ", err);
      else {
        // console.log("Removed local: ", localPath);
      }
    });
  },

  removeUnusedMulterImageFilesOnError: (req) => {
    try {
      const multerFile = req.file;
      const multerFiles = req.files;

      if (multerFile) {
        // If there is file uploaded and there is validation error
        // We want to remove that file
        removeLocalFile(multerFile.path);
      }

      if (multerFiles) {
        const filesValueArray = Object.values(multerFiles);
        // If there are multiple files uploaded for more than one fields
        // We want to remove those files as well
        filesValueArray.map((fileFields) => {
          fileFields.map((fileObject) => {
            removeLocalFile(fileObject.path);
          });
        });
      }
    } catch (error) {
      // fail silently
      console.log("Error while removing image files: ", error);
    }
  },

  verifyPermission: (roles = []) =>
    asyncHandler(async (req, res, next) => {
      if (!req.user?._id) {
        throw new ApiError(401, "Unauthorized request");
      }
      if (roles.includes(req.user?.role)) {
        next();
      } else {
        throw new ApiError(403, "You are not allowed to perform this action");
      }
  }),

  pagination: (data) => {
    perPage = Number.parseInt(data.perPage);
    page = Number.parseInt(data.page);
    if (!perPage && !page) {
      return {
        perPage: 0,
        page: 0,
      };
    } else {
      return { perPage, page };
    }
  },

  generateToken: async (data) => {
    try {
      // let token = jwt.sign(data, process.env.SECRET_PRIVATE_KEY, { expiresIn: '1d' })
      let token = jwt.sign(data, process.env.TOKEN_SECRET);
      return { status: 1, token };
    } catch (err) {
      return {
        status: 0,
        message: "token does not generated",
      };
    }
  },

  verifyToken: async (token) => {
    try {
      let verify = jwt.verify(token, process.env.TOKEN_SECRET);
      return { status: 1, verify };
    } catch (err) {
      return {
        status: 0,
        message: "token does not verified",
      };
    }
  },

  sendMailer: async (email, text, title) => {
    try {
      let transporter = nodeMailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        requireTLS: true,
        auth: {
          user: process.env.E_MAIL,
          pass: process.env.PASSWORD,
        },
      });

      let info = await transporter.sendMail({
        from: process.env.E_MAIL,
        to: email,
        subject: title || "",
        text: "",
        html: text,
      });
      return { status: 1, info };
    } catch (err) {
      console.log(err);
      return {
        status: 0,
        message: "mail not send",
      };
    }
  },

  PushNotification: async (fcmToken, message, data) => {
    try {
      const payload = {
        notification: {
          title: "",
          body: message,
        },
        data: {
          type: data,
        },
      };

      const res1 =
        fcmToken?.length > 0 &&
        fcmToken?.map(async (token) => {
          const response = await userAccount
            .messaging()
            .sendToDevice(token, payload);
          // console.log('Notification sent successfully:', response);

          if (response.successCount == 1) {
            // console.log(token);
            return token;
          }
        });
      // console.log(await Promise.all(res1), "11111111111111");
      return (await Promise.all(res1)) || [];

      // fcmToken?.length > 0 && fcmToken?.forEach((token) => {
      //     userAccount.messaging().sendToDevice(token, payload)
      //     .then( async (response) => {
      //         console.log('Push notification sent successfully.');
      //       console.log('Notification sent successfully:', response);
      //         console.log(response.successCount, "response.successCountresponse.successCountresponse.successCountresponse.successCount");
      //       if( response.successCount == 1 ){
      //          res.push(token);
      //       }

      //     })
      //     .catch((error) => {
      //       console.error('Error sending notification:', error);
      //     });
      // });
      // console.log(res, "ressssssssssssssssssssssnnnnnnnnn");
      // return res;
    } catch (err) {
      return {
        status: 0,
        message: "Notification not send",
      };
    }
  },

};
