// const asyncHandler = (requestHandler) => {
//     return (req, res, next) => {
//         return Promise.resolve(requestHandler(req, res, next)).catch((err) => next(err));
//     }
// }

const asyncHandler = (requestHandler) => {
    return async (req, res, next) => {
        try {   
            await requestHandler(req, res, next);
        } catch (error) {
            next(error)
        }
    }
}

module.exports = { asyncHandler };
