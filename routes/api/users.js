const express = require("express");
const Joi = require("joi");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const gravatar = require("gravatar");
const path = require("path");
const Jimp = require("jimp");
const fs = require("fs/promises");
const { createError, createHashPassword } = require("../../helpers");
const User = require("../../models/user");
const { authorize, upload } = require("../../middlewares");

const registerUserSchema = Joi.object({
  subscription: Joi.string(),
  password: Joi.string().min(6).required(),
  email: Joi.string().required(),
});

const signInUserSchema = Joi.object({
  password: Joi.string().min(6).required(),
  email: Joi.string().required(),
});
const { SECRET_KEY } = process.env;
const router = express.Router();

router.post("/register", async (req, res, next) => {
  try {
    const { error } = registerUserSchema.validate(req.body);
    if (error) {
      throw createError(400, error.message);
    }

    const { email, password, subscription } = req.body;
    const user = await User.findOne({ email });
    if (user) {
      throw createError(409, "Email in use");
    }

    const hashPassword = await createHashPassword(password);
    const avatarURL = gravatar.url(email);
    const newUser = await User.create({
      email,
      subscription,
      password: hashPassword,
      avatarURL,
    });
    res.status(201).json({
      email: newUser.email,
      subscription: newUser.subscription,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { error } = signInUserSchema.validate(req.body);
    if (error) {
      throw createError(400, error.message);
    }

    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      throw createError(401, "Credentials are wrong");
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      throw createError(401, "Credentials are wrong");
    }
    const payload = {
      id: user._id,
    };

    const token = jwt.sign(payload, SECRET_KEY, { expiresIn: "1h" });

    await User.findByIdAndUpdate({ _id: user._id }, { token });

    res.json({
      token,
      user: {
        email,
        subscription: user.subscription,
      },
    });
  } catch (error) {
    next(error);
  }
});
router.get("/logout", authorize, async (req, res, next) => {
  try {
    const { _id } = req.user;
    await User.findByIdAndUpdate(_id, { token: "" });
    res.json({
      message: "Logout successfull",
    });
  } catch (error) {
    next(error);
  }
});

router.get("/current", authorize, async (req, res, next) => {
  try {
    const { email, subscription } = req.user;
    res.json({
      email,
      subscription,
    });
  } catch (error) {
    next(error);
  }
});
router.patch(
  "/avatars",
  authorize,
  upload.single("avatar"),
  async (req, res, next) => {
    try {
      const { _id } = req.user;
      const { path: tempDir, originalname } = req.file;
      const [extention] = originalname.split(".").reverse();
      const newName = `${_id}.${extention}`;

      const uploadDir = path.join(
        __dirname,
        "../../",
        "public",
        "avatars",
        newName
      );

      const image = await Jimp.read(tempDir);
      const resizedImage = image.resize(250, 250);
      resizedImage.write(tempDir);

      await fs.rename(tempDir, uploadDir);

      const avatarURL = path.join("avatars", newName);
      await User.findByIdAndUpdate(_id, { avatarURL });
      res.status(201).json(avatarURL);
    } catch (error) {
      await fs.unlink(req.file.path);
      next(error);
    }
  }
);

module.exports = router;
