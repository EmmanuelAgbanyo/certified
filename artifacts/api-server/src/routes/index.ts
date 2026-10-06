import { Router, type IRouter } from "express";
import adminRouter from "./admin";
import certificatesRouter from "./certificates";
import healthRouter from "./health";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(adminRouter);
router.use(certificatesRouter);
router.use(storageRouter);

export default router;
