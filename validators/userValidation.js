const { body } = require("express-validator")

const userRegisterValidator = () => {
    return [
       body('email')
        .trim()
        .notEmpty()
        .withMessage('Email is required')
        .isEmail()
        .withMessage("Email is invalid"),
       body('name')
        .trim()
        .notEmpty()
        .withMessage('Email is required')
        .isLength({ min: 3 })
        .withMessage("Username must be at lease 3 characters long"),
       body('password')
        .trim()
        .notEmpty()
        .withMessage('Password is required')
        .isLength({ min: 6 })
        .withMessage("Password must be at least 6 characters long"),
    ]
}

const userLoginValidator = () => {
    return [
       body('email')
        .trim()
        .notEmpty()
        .withMessage('Email is required')
        .isEmail()
        .withMessage("Email is invalid"),
       body('password')
        .trim()
        .notEmpty()
        .withMessage('Password is required')
    ]
}


module.exports = {
    userRegisterValidator,
    userLoginValidator
}
