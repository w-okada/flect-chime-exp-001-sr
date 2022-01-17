import React, { useEffect, useState } from "react";
import logo from "./logo.svg";
import "./App.css";
import { useVideoInputList } from "./hooks/useVideoInputList";
import {
  DropDown,
  SingleValueSlider,
  Toggle,
  VideoInputSelect,
} from "./components/components";
import {
  generateDefaultSuperResolutionParams,
  generateSuperResolutionDefaultConfig,
  SuperResolutionWorkerManager,
  InterpolationType,
  SuperResolutionConfig,
  SuperResolutionOperationParams,
} from "@dannadori/super-resolution-worker-js";
import { VideoInputType } from "./const";
import { useChimeClientPair } from "./hooks/uesChimeClientPair";
import ForwardIcon from "@material-ui/icons/Forward";
import { ImageScore } from "@dannadori/image-score-js";
import { useScheduler } from "./hooks/useScheduler";
import { RS_TEST, RS_TRAIN } from "./resources";

let GlobalLoopID: number = 0;
let GlobalLoopID2: number = 0;

const models: { [name: string]: string } = {
  x1: `${process.env.PUBLIC_URL}/models/model_x2_nopadding_chime.tflite`, // Dummy
  x2: `${process.env.PUBLIC_URL}/models/model_x2_nopadding_chime.tflite`,
  x3: `${process.env.PUBLIC_URL}/models/model_x3_nopadding_chime.tflite`,
  x4: `${process.env.PUBLIC_URL}/models/model_x4_nopadding_chime.tflite`,
  x1org: `${process.env.PUBLIC_URL}/models/model_x2_nopadding.tflite`, // Dummy
  x2org: `${process.env.PUBLIC_URL}/models/model_x2_nopadding.tflite`,
  x3org: `${process.env.PUBLIC_URL}/models/model_x3_nopadding.tflite`,
  x4org: `${process.env.PUBLIC_URL}/models/model_x4_nopadding.tflite`,
};

const tfjsModels: { [name: string]: string } = {
  x1: `${process.env.PUBLIC_URL}/tensorflowjs/model_x2_nopadding_chime_tfjs/model.json`, // Dummy
  x2: `${process.env.PUBLIC_URL}/tensorflowjs/model_x2_nopadding_chime_tfjs/model.json`,
  x3: `${process.env.PUBLIC_URL}/tensorflowjs/model_x3_nopadding_chime_tfjs/model.json`,
  x4: `${process.env.PUBLIC_URL}/tensorflowjs/model_x4_nopadding_chime_tfjs/model.json`,
  x1org: `${process.env.PUBLIC_URL}/tensorflowjs/model_x2_nopadding_tfjs/model.json`, // Dummy
  x2org: `${process.env.PUBLIC_URL}/tensorflowjs/model_x2_nopadding_tfjs/model.json`,
  x3org: `${process.env.PUBLIC_URL}/tensorflowjs/model_x3_nopadding_tfjs/model.json`,
  x4org: `${process.env.PUBLIC_URL}/tensorflowjs/model_x4_nopadding_tfjs/model.json`,
};

const scaleFactors: { [name: string]: number } = {
  x1: 1,
  x2: 2,
  x3: 3,
  x4: 4,
  x1org: 1,
  x2org: 2,
  x3org: 3,
  x4org: 4,
};

const OutputViewType = {
  ESPCN: InterpolationType.INTER_ESPCN,
  // "LANCZOS4": InterpolationType.INTER_LANCZOS4,
  CUBIC: InterpolationType.INTER_CUBIC,
  // "AREA": InterpolationType.INTER_AREA,
  // "LINEAR": InterpolationType.INTER_LINEAR,
  // "NEAREST": InterpolationType.INTER_NEAREST,
  CANVAS: InterpolationType.CANVAS,
  ALL: 300,
  SPLIT_ESPCN_CUBIC: 400,
  SPLIT_ESPCN_CANVAS: 500,
};

const outputViewTypes: { [name: string]: number } = {
  ESPCN: OutputViewType.ESPCN,
  CUBIC: OutputViewType.CUBIC,
  CANVAS: OutputViewType.CANVAS,
  ALL: OutputViewType.ALL,
  SPLIT_CUBIC: OutputViewType.SPLIT_ESPCN_CUBIC,
  SPLIT_CANVAS: OutputViewType.SPLIT_ESPCN_CANVAS,
};

interface WorkerProps {
  manager: SuperResolutionWorkerManager;
  params: SuperResolutionOperationParams;
  config: SuperResolutionConfig;
  count: number;
}
interface InputMedia {
  mediaType: VideoInputType;
  media: MediaStream | string;
}

const splitProps = {
  splitX: 0,
};

function App() {
  const { videoInputList } = useVideoInputList();
  const [workerProps, setWorkerProps] = useState<WorkerProps>();
  const { meetingSession1, meetingSession2, stateUpdateTime } =
    useChimeClientPair({});
  const { tenSecondsTaskTrigger } = useScheduler();

  const [modelKey, setModelKey] = useState(Object.keys(models)[1]);
  // const [interpolationTypeKey, setInterpolationTypeKey] = useState(Object.keys(interpolationTypes)[0])
  const [outputViewTypeKey, setOutputViewTypeKey] = useState(
    Object.keys(outputViewTypes)[0]
  );
  const [useSIMD, setUseSIMD] = useState(false);
  const [useTensorflowJS, setUseTensorflowJS] = useState(true);
  const [inputSize, setInputSize] = useState(480);
  const [onLocal, setOnLocal] = useState(true);

  const [applyToSrc, setApplyToSrc] = useState(false);
  const [calcScore, setCalcScore] = useState(false);

  const [splitX, setSplitX] = useState(0);

  const [startDataGen, setStartDataGen] = useState(false);
  const [startEval, setStartEval] = useState(false);

  const [inputMedia, setInputMedia] = useState<InputMedia>({
    mediaType: "IMAGE",
    media: "img/yuka_kawamura.jpg",
  });
  const inputChange = (
    mediaType: VideoInputType,
    input: MediaStream | string
  ) => {
    console.log("inputChange", mediaType, input);
    setInputMedia({ mediaType: mediaType, media: input });
  };

  const [imageScore, setImageScore] = useState<ImageScore>();
  useEffect(() => {
    const is = new ImageScore();
    is.init();
    setImageScore(is);
  }, []);

  /// input設定
  useEffect(() => {
    const video = document.getElementById("input_video") as HTMLVideoElement;
    if (inputMedia.mediaType === "IMAGE") {
      const img = document.getElementById("input_img") as HTMLImageElement;
      img.onloadeddata = () => {
        // setLayout()
      };
      img.src = inputMedia.media as string;
    } else if (inputMedia.mediaType === "MOVIE") {
      const vid = document.getElementById("input_video") as HTMLVideoElement;
      vid.pause();
      vid.srcObject = null;
      vid.src = inputMedia.media as string;
      vid.loop = true;
      vid.onloadeddata = () => {
        video.play();
        // setLayout()
      };
    } else if (inputMedia.mediaType === "MOVIE_URL") {
      const vid = document.getElementById("input_video") as HTMLVideoElement;
      vid.pause();
      vid.srcObject = null;
      console.log("MOVIE_URL", inputMedia.media);
      vid.src = inputMedia.media as string;
      vid.loop = true;
      vid.onloadeddata = () => {
        video.play();
        // resizeDst(vid)
      };
      // setSrc(vid)
    } else if (inputMedia.mediaType === "IMAGE_URL") {
      const img = document.getElementById("input_img") as HTMLImageElement;
      img.onloadeddata = () => {
        // setLayout()
      };
      img.src = inputMedia.media as string;
    } else {
      const vid = document.getElementById("input_video") as HTMLVideoElement;
      vid.pause();
      vid.srcObject = inputMedia.media as MediaStream;
      vid.onloadeddata = () => {
        video.play();
        // setLayout()
      };
    }
  }, [inputMedia]); // eslint-disable-line

  /////////////////////
  /// Chime Setting  //
  /////////////////////
  //// (1) initialize: set source mediastream from canvas
  useEffect(() => {
    if (!meetingSession1) {
      return;
    }

    const sent = document.getElementById("to_be_sent") as HTMLCanvasElement;

    // @ts-ignore
    const ms = sent.captureStream();
    meetingSession1.audioVideo.chooseVideoInputDevice(ms).then(() => {
      meetingSession1.audioVideo.startLocalVideoTile();
    });
  }, [meetingSession1, modelKey]);

  //// (2) initialize: set destination video element
  useEffect(() => {
    if (!meetingSession1 || !meetingSession2) {
      return;
    }

    const recv = document.getElementById("received_video") as HTMLVideoElement;
    const remoteTile = meetingSession2.audioVideo.getAllRemoteVideoTiles();
    if (remoteTile.length > 0) {
      remoteTile[0].bindVideoElement(recv);
    }
  }, [meetingSession1, meetingSession2, stateUpdateTime]);

  ///////////////////////////
  /// プロパティ設定      ///
  ///////////////////////////
  //// モデル切り替え
  useEffect(() => {
    const init = async () => {
      const m = workerProps
        ? workerProps.manager
        : new SuperResolutionWorkerManager();
      const count = workerProps ? workerProps.count + 1 : 0;
      const c = generateSuperResolutionDefaultConfig();
      c.processOnLocal = onLocal;
      c.modelPath = models[modelKey];
      c.tfjsModelPath = tfjsModels[modelKey];
      c.enableSIMD = true;

      await m.init(c);

      const p = generateDefaultSuperResolutionParams();
      p.inputHeight = inputSize;
      p.inputWidth = inputSize;
      // p.interpolation = interpolationTypes[interpolationTypeKey]
      p.scaleFactor = scaleFactors[modelKey];
      p.useSIMD = useSIMD;
      p.useTensorflowjs = useTensorflowJS;
      const newProps = { manager: m, config: c, params: p, count: count };
      console.log("CALLED new MANAGER", onLocal);
      setWorkerProps(newProps);
    };
    init();
  }, [modelKey, onLocal]); // eslint-disable-line

  //// パラメータ変更
  useEffect(() => {
    if (!workerProps) {
      return;
    }
    const p = generateDefaultSuperResolutionParams();
    // p.interpolation = interpolationTypes[interpolationTypeKey]
    p.scaleFactor = scaleFactors[modelKey];
    p.useSIMD = useSIMD;
    p.useTensorflowjs = useTensorflowJS;
    setWorkerProps({ ...workerProps, params: p });
  }, [useSIMD, useTensorflowJS, onLocal]); // eslint-disable-line

  //////////////
  ///// util  //
  //////////////

  const setLayout2 = () => {
    const scaleFactor = scaleFactors[modelKey];
    //// Fix size for easy
    const orgWidth = inputSize;
    const orgHeight = (inputSize * 3) / 4;
    let commWidth = Math.trunc(orgWidth / scaleFactor);
    let commHeight = Math.trunc(orgHeight / scaleFactor);

    const inputElem =
      inputMedia.mediaType === "IMAGE" || inputMedia.mediaType === "IMAGE_URL"
        ? (document.getElementById("input_img") as HTMLImageElement)
        : (document.getElementById("input_video") as HTMLVideoElement);
    const org = document.getElementById("original") as HTMLCanvasElement;
    const sent = document.getElementById("to_be_sent") as HTMLCanvasElement;
    const recv = document.getElementById("received_video") as HTMLVideoElement;
    const dst_espcn = document.getElementById(
      "output_espcn"
    ) as HTMLCanvasElement;
    const dst_cubic = document.getElementById(
      "output_cubic"
    ) as HTMLCanvasElement;
    const dst_canvas = document.getElementById(
      "output_canvas"
    ) as HTMLCanvasElement;

    [inputElem, org, dst_espcn, dst_cubic, dst_canvas].forEach((e) => {
      if (e.width != orgWidth) e.width = orgWidth;
      if (e.height != orgHeight) e.height = orgHeight;
    });

    [sent, recv].forEach((e) => {
      if (e.width != commWidth) e.width = commWidth;
      if (e.height != commHeight) e.height = commHeight;
    });
  };

  ////////////////////////
  //  Data Generator    //
  ////////////////////////
  useEffect(() => {
    if (!startDataGen) {
      return;
    }

    const ORG_WIDTH = 960;
    const ORG_HEIGHT = 720;

    const sent = document.getElementById("to_be_sent") as HTMLCanvasElement;
    const org = document.getElementById("original") as HTMLCanvasElement;
    const recv = document.getElementById("received_video") as HTMLVideoElement;
    const recv_canvas = document.getElementById(
      "receive-canvas"
    ) as HTMLCanvasElement;

    const exe = async () => {
      // const TARGET = RS_TRAIN
      const TARGET = RS_TEST;
      const OFFSET = 800;

      for (let i = 0; i < TARGET.length; i++) {
        const path = TARGET[i];
        console.log(path);
        const img = document.createElement("img");
        const p = new Promise<void>((resolve, reject) => {
          img.onloadedmetadata = () => {
            resolve();
          };
          img.onloadeddata = () => {
            resolve();
          };
          img.onload = () => {
            resolve();
          };
        });

        img.src = path;
        await p;

        const ratioW = ORG_WIDTH / img.naturalWidth;
        const ratioH = ORG_HEIGHT / img.naturalHeight;

        const ratio = Math.max(ratioW, ratioH);
        org.width = ORG_WIDTH;
        org.height = ORG_HEIGHT;
        const orgCtx = org.getContext("2d")!;

        console.log(
          path,
          Math.ceil(ratio * img.width),
          Math.ceil(ratio * img.height)
        );

        const sizes = [
          [480, 360],
          [320, 240],
          [240, 180],
        ];
        const countStr = (i + OFFSET).toString().padStart(4, "0");
        const h_name = `${countStr}.png`;
        for (let j = 0; j < sizes.length; j++) {
          orgCtx.drawImage(
            img,
            0,
            0,
            Math.ceil(ratio * img.width),
            Math.ceil(ratio * img.height)
          );
          const [w, h] = sizes[j];
          sent.width = w;
          sent.height = h;
          recv.width = w;
          recv.height = h;
          recv_canvas.width = w;
          recv_canvas.height = h;
          const sentCtx = sent.getContext("2d")!;
          sentCtx.drawImage(org, 0, 0, sent.width, sent.height);
          await new Promise<void>((resolve, reject) => {
            setTimeout(() => {
              resolve();
            }, 1000 * 4);
          });
          const recvCtx = recv_canvas.getContext("2d")!;
          recvCtx.drawImage(recv, 0, 0, recv_canvas.width, recv_canvas.height);

          const l_name = `${countStr}_${w}x${h}.png`;
          let link = document.createElement("a");
          link.href = recv_canvas.toDataURL("image/png");
          link.download = l_name;
          link.click();
        }
        let link = document.createElement("a");
        link.href = org.toDataURL("image/png");
        link.download = h_name;
        link.click();
      }
    };
    exe();
  }, [startDataGen]);

  //////////////////
  //  Eval       //
  //////////////////
  useEffect(() => {
    if (!startEval) {
      return;
    }
    const ORG_WIDTH = 960;
    const ORG_HEIGHT = 720;

    const org = document.getElementById("original") as HTMLCanvasElement;
    const dst = document.getElementById("output_espcn") as HTMLCanvasElement;

    const exe = async () => {
      const TARGET = RS_TEST;
      const OFFSET = 800;

      const psnrs: number[] = [];
      const mssimRs: number[] = [];
      const mssimGs: number[] = [];
      const mssimBs: number[] = [];

      for (let i = 0; i < TARGET.length; i++) {
        // for(let i=0; i<5;i++){
        const path = TARGET[i];
        console.log(path);

        const img = document.getElementById("input_img") as HTMLImageElement;
        const p = new Promise<void>((resolve, reject) => {
          img.onloadedmetadata = () => {
            resolve();
          };
          img.onloadeddata = () => {
            resolve();
          };
          img.onload = () => {
            resolve();
          };
        });

        img.src = path;
        await p;
        // img.src = tmpCanvas.toDataURL()

        // (3) Wait Transmit
        await new Promise<void>((resolve, reject) => {
          setTimeout(() => {
            resolve();
          }, 1000 * 2);
        });

        // (4) Calc Score
        if (imageScore) {
          imageScore.setImage(org, dst as HTMLCanvasElement, {
            useSimd: useSIMD,
          });
          const psnr = imageScore.psnr({ useSimd: useSIMD });
          const { mssimR, mssimG, mssimB, mssimA } = imageScore.mssim({
            useSimd: useSIMD,
          });
          console.log(
            `psnr: ${psnr.toFixed(2)} mssim:${mssimR.toFixed(
              2
            )},${mssimG.toFixed(2)},${mssimB.toFixed(2)}`
          );
          psnrs.push(psnr);
          mssimRs.push(mssimR);
          mssimGs.push(mssimG);
          mssimBs.push(mssimB);

          const [psnr_avr, mssimR_avr, mssimG_avr, mssimB_avr] = [
            psnrs,
            mssimRs,
            mssimGs,
            mssimBs,
          ].map((arr) => {
            return (
              arr.reduce((prev, current) => {
                return prev + current;
              }, 0) / arr.length
            );
          });
          console.log(
            `psnr: ${psnr_avr.toFixed(2)} mssim:${mssimR_avr.toFixed(
              2
            )},${mssimG_avr.toFixed(2)},${mssimB_avr.toFixed(2)}`
          );
          const eval_info = document.getElementById(
            "eval_info"
          ) as HTMLDivElement;
          eval_info.innerText = `avr psnr: ${psnr_avr.toFixed(
            2
          )} mssim:${mssimR_avr.toFixed(2)},${mssimG_avr.toFixed(
            2
          )},${mssimB_avr.toFixed(2)}`;
        }
        console.log("PSNRS:", psnrs);
        console.log("mssimRs:", mssimRs);
        console.log("mssimGs:", mssimGs);
        console.log("mssimBs:", mssimBs);
      }
    };
    exe();
  }, [startEval]);

  ///////////////////////////////////////
  //  pipeline 1 (for senditng data)   //
  ///////////////////////////////////////
  useEffect(() => {
    if (startDataGen) {
      return;
    }
    console.log("[Pipeline] Start", workerProps);
    let renderRequestId: number;
    const LOOP_ID = performance.now();
    GlobalLoopID = LOOP_ID;

    const src =
      inputMedia.mediaType === "IMAGE" || inputMedia.mediaType === "IMAGE_URL"
        ? (document.getElementById("input_img") as HTMLImageElement)
        : (document.getElementById("input_video") as HTMLVideoElement);
    const org = document.getElementById("original") as HTMLCanvasElement;
    const sent = document.getElementById("to_be_sent") as HTMLCanvasElement;

    const render = async () => {
      // console.log("RENDER::::", LOOP_ID, renderRequestId, workerProps?.params)
      setLayout2();

      if (
        src.width === 0 ||
        src.height === 0 ||
        sent.width === 0 ||
        sent.height === 0
      ) {
        renderRequestId = requestAnimationFrame(render);
        return;
      }

      const start = performance.now();

      const inputWidth =
        inputMedia.mediaType === "IMAGE" || inputMedia.mediaType === "IMAGE_URL"
          ? (src as HTMLImageElement).naturalWidth
          : (src as HTMLVideoElement).videoWidth;
      const inputHeight =
        inputMedia.mediaType === "IMAGE" || inputMedia.mediaType === "IMAGE_URL"
          ? (src as HTMLImageElement).naturalHeight
          : (src as HTMLVideoElement).videoHeight;

      const ratioX = org.width / inputWidth;
      const ratioY = org.height / inputHeight;
      const ratio = Math.max(ratioX, ratioY);
      const drawWidth = inputWidth * ratio;
      const drawHeight = inputHeight * ratio;

      const org_ctx = org.getContext("2d")!;
      org_ctx.drawImage(src, 0, 0, drawWidth, drawHeight);
      const sent_ctx = sent.getContext("2d")!;
      sent_ctx.drawImage(org, 0, 0, sent.width, sent.height);

      if (GlobalLoopID === LOOP_ID) {
        renderRequestId = requestAnimationFrame(render);
      }
    };
    render();
    return () => {
      console.log("CANCEL", renderRequestId);
      cancelAnimationFrame(renderRequestId);
    };
  }, [workerProps, inputMedia, inputSize, startDataGen]); // eslint-disable-line

  useEffect(() => {
    const dst = document.getElementById("output_espcn") as HTMLCanvasElement;
    const handleMouseMove = (e: MouseEvent) => {
      // console.log(e)
      // setSplitX(e.offsetX)
      splitProps.splitX = e.offsetX;
    };
    dst.addEventListener("mousemove", handleMouseMove);
    return () => {
      dst.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  ////////////////////////////////////////////////////
  //  pipeline 2  (for interpolating recived data)  //
  ////////////////////////////////////////////////////
  useEffect(() => {
    if (startDataGen) {
      return;
    }
    console.log("[Pipeline] Start", workerProps);
    let renderRequestId: number;
    const LOOP_ID = performance.now();
    GlobalLoopID2 = LOOP_ID;

    const src = document.getElementById("input_img")
      ? (document.getElementById("input_img") as HTMLImageElement)
      : (document.getElementById("input_video") as HTMLVideoElement);
    const org = document.getElementById("original") as HTMLCanvasElement;
    const sent = document.getElementById("to_be_sent") as HTMLCanvasElement;
    const recv = document.getElementById("received_video") as HTMLVideoElement;
    const dst = document.getElementById("output_espcn") as HTMLCanvasElement;
    const dst_cubic = document.getElementById(
      "output_cubic"
    ) as HTMLCanvasElement;
    const dst_canvas = document.getElementById(
      "output_canvas"
    ) as HTMLCanvasElement;

    const info = document.getElementById("espcn_info") as HTMLDivElement;
    const cubic_info = document.getElementById("cubic_info") as HTMLDivElement;
    const canvas_info = document.getElementById(
      "canvas_info"
    ) as HTMLDivElement;
    // Hide unsed element
    if (outputViewTypes[outputViewTypeKey] === OutputViewType.ALL) {
      dst.style.display = "block";
      dst_cubic.style.display = "block";
      dst_canvas.style.display = "block";
      info.style.display = "block";
      cubic_info.style.display = "block";
      canvas_info.style.display = "block";
    } else {
      dst.style.display = "block";
      dst_cubic.style.display = "none";
      dst_canvas.style.display = "none";
      info.style.display = "block";
      cubic_info.style.display = "none";
      canvas_info.style.display = "none";
    }

    const getPredictionImage = async (
      workerProps: WorkerProps,
      sent: HTMLCanvasElement,
      recv: HTMLVideoElement,
      interpolationType: number
    ) => {
      workerProps.params.inputWidth = recv.width;
      workerProps.params.inputHeight = recv.height;
      workerProps.params.interpolation = interpolationType;
      let prediction;
      if (applyToSrc) {
        prediction = await workerProps.manager.predict(
          sent!,
          workerProps.params
        );
      } else {
        prediction = await workerProps.manager.predict(
          recv!,
          workerProps.params
        );
      }
      if (!prediction) {
      } else {
        try {
          const resizedImage = new ImageData(
            new Uint8ClampedArray(prediction),
            workerProps.params.inputWidth * workerProps.params.scaleFactor,
            workerProps.params.inputHeight * workerProps.params.scaleFactor
          );
          return resizedImage;
        } catch (e) {}
      }
      return null;
    };

    const render = async () => {
      // console.log("RENDER::::", LOOP_ID, renderRequestId, workerProps?.params)
      // setLayout3()

      if (
        src.width === 0 ||
        src.height === 0 ||
        sent.width === 0 ||
        sent.height === 0 ||
        recv.width === 0 ||
        recv.height === 0
      ) {
        renderRequestId = requestAnimationFrame(render);
        return;
      }
      if (workerProps) {
        if (workerProps.params.scaleFactor === 1) {
          // (1) Scale Factor is 0 => copy recv to dst
          const dstCtx = dst.getContext("2d")!;
          dstCtx.drawImage(recv, 0, 0, dst.width, dst.height);
          if (calcScore && imageScore) {
            imageScore.setImage(org, dst as HTMLCanvasElement, {
              useSimd: useSIMD,
            });
            const psnr = imageScore.psnr({ useSimd: useSIMD });
            const { mssimR, mssimG, mssimB, mssimA } = imageScore.mssim({
              useSimd: useSIMD,
            });
            (
              info as HTMLDivElement
            ).innerHTML = `COPY <br/> psnr: ${psnr.toFixed(
              2
            )}<br/> mssim:${mssimR.toFixed(2)},${mssimG.toFixed(
              2
            )},${mssimB.toFixed(2)}`;
          } else {
            (info as HTMLDivElement).innerHTML = `COPY <br/> `;
          }
        } else if (
          outputViewTypes[outputViewTypeKey] === OutputViewType.ESPCN
        ) {
          // (2) ESPCN
          const dstCtx = dst.getContext("2d")!;
          const image = await getPredictionImage(
            workerProps,
            sent,
            recv,
            InterpolationType.INTER_ESPCN
          );
          if (image) {
            dstCtx.putImageData(image, 0, 0);
          }
          info.innerHTML = `ESPCN <br/> `;
        } else if (
          outputViewTypes[outputViewTypeKey] === OutputViewType.CUBIC
        ) {
          // (3) Cubic
          const dstCtx = dst.getContext("2d")!;
          const image = await getPredictionImage(
            workerProps,
            sent,
            recv,
            InterpolationType.INTER_CUBIC
          );
          if (image) {
            dstCtx.putImageData(image, 0, 0);
          }
          info.innerHTML = `CUBIC <br/> `;
        } else if (
          outputViewTypes[outputViewTypeKey] === OutputViewType.CANVAS
        ) {
          // (3) Canvas
          const dstCtx = dst.getContext("2d")!;
          dstCtx.drawImage(recv, 0, 0, dst_canvas.width, dst_canvas.height);
          info.innerHTML = `CANVAS <br/> `;
        } else if (outputViewTypes[outputViewTypeKey] === OutputViewType.ALL) {
          // (3) Canvas
          const dstCtx = dst.getContext("2d")!;
          const dstCubicCtx = dst_cubic.getContext("2d")!;
          const dstCanvasCtx = dst_canvas.getContext("2d")!;
          const image = await getPredictionImage(
            workerProps,
            sent,
            recv,
            InterpolationType.INTER_ESPCN
          );
          const imageCubic = await getPredictionImage(
            workerProps,
            sent,
            recv,
            InterpolationType.INTER_CUBIC
          );
          if (image) {
            dstCtx.putImageData(image, 0, 0);
          }
          if (imageCubic) {
            dstCubicCtx.putImageData(imageCubic, 0, 0);
          }
          dstCanvasCtx.drawImage(
            recv,
            0,
            0,
            dst_canvas.width,
            dst_canvas.height
          );

          if (imageScore) {
            [
              [info, dst, "ESPCN"],
              [cubic_info, dst_cubic, "CUBIC"],
              [canvas_info, dst_canvas, "CANVAS"],
            ].forEach(([info, dst, label]) => {
              if (calcScore) {
                imageScore.setImage(org, dst as HTMLCanvasElement, {
                  useSimd: useSIMD,
                });
                console.log(
                  `SCORE::::: ${org.width} ${org.height} ${
                    (dst as HTMLCanvasElement).width
                  } ${(dst as HTMLCanvasElement).height}`
                );
                const psnr = imageScore.psnr({ useSimd: useSIMD });
                const { mssimR, mssimG, mssimB, mssimA } = imageScore.mssim({
                  useSimd: useSIMD,
                });
                (info as HTMLDivElement).innerHTML = `${
                  label as string
                } <br/> psnr: ${psnr.toFixed(2)}<br/> mssim:${mssimR.toFixed(
                  2
                )},${mssimG.toFixed(2)},${mssimB.toFixed(2)}`;
              } else {
                (info as HTMLDivElement).innerHTML = `${
                  label as string
                } <br/> `;
              }
            });
          }
        } else if (
          outputViewTypes[outputViewTypeKey] ===
          OutputViewType.SPLIT_ESPCN_CUBIC
        ) {
          const dstCtx = dst.getContext("2d")!;
          const image = await getPredictionImage(
            workerProps,
            sent,
            recv,
            InterpolationType.INTER_ESPCN
          );
          const imageCubic = await getPredictionImage(
            workerProps,
            sent,
            recv,
            InterpolationType.INTER_CUBIC
          );
          if (imageCubic) {
            // dstCtx.putImageData(imageCubic, 0, 0, splitProps.splitX, 0, dst.width-splitProps.splitX, dst.height)
            dstCtx.putImageData(imageCubic, 0, 0);
          }
          if (image) {
            dstCtx.putImageData(
              image,
              0,
              0,
              0,
              0,
              splitProps.splitX,
              dst.height
            );
          }
          dstCtx.beginPath();
          dstCtx.moveTo(splitProps.splitX, 0);
          dstCtx.lineTo(splitProps.splitX, dst.height);
          dstCtx.strokeStyle = "red";
          dstCtx.lineWidth = 1;
          dstCtx.stroke();
        } else if (
          outputViewTypes[outputViewTypeKey] ===
          OutputViewType.SPLIT_ESPCN_CANVAS
        ) {
          const dstCtx = dst.getContext("2d")!;
          const image = await getPredictionImage(
            workerProps,
            sent,
            recv,
            InterpolationType.INTER_ESPCN
          );
          dstCtx.drawImage(recv, 0, 0, dst_canvas.width, dst_canvas.height);
          if (image) {
            // const resizedImage = new ImageData(dst.width, dst.height)
            dstCtx.putImageData(
              image,
              0,
              0,
              0,
              0,
              splitProps.splitX,
              dst.height
            );
          }
          dstCtx.beginPath();
          dstCtx.moveTo(splitProps.splitX, 0);
          dstCtx.lineTo(splitProps.splitX, dst.height);
          dstCtx.strokeStyle = "red";
          dstCtx.lineWidth = 1;
          dstCtx.stroke();
        }
      }

      const input_info = document.getElementById(
        "input_info"
      ) as HTMLDivElement;
      const send_info = document.getElementById("send_info") as HTMLDivElement;
      const recieve_info = document.getElementById(
        "receive_info"
      ) as HTMLDivElement;
      const recover_info = document.getElementById(
        "recover_info"
      ) as HTMLDivElement;
      input_info.innerText = `${src.width}x${src.height}`;
      send_info.innerText = `${sent.width}x${sent.height}`;
      recieve_info.innerText = `${recv.width}x${recv.height} (${recv.videoWidth}x${recv.videoHeight})`;
      recover_info.innerText = `${dst_canvas.width}x${dst_canvas.height}`;

      if (GlobalLoopID2 === LOOP_ID) {
        renderRequestId = requestAnimationFrame(render);
      }
      //         // const end = performance.now()
      //         // const info2 = document.getElementById("info2") as HTMLCanvasElement
      //         // info2.innerText = `processing time: ${end - start}`
    };
    render();
    return () => {
      console.log("CANCEL", renderRequestId);
      cancelAnimationFrame(renderRequestId);
    };
  }, [
    workerProps,
    inputMedia,
    inputSize,
    imageScore,
    startDataGen,
    applyToSrc,
    calcScore,
    outputViewTypeKey,
    splitX,
  ]); // eslint-disable-line

  console.log("CHANGE INPUT TYPE", inputMedia.mediaType);
  return (
    <div className="App">
      <div style={{ display: "flex", flexDirection: "row" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <VideoInputSelect
            title="input"
            current={""}
            onchange={inputChange}
            options={videoInputList}
          />
          <DropDown
            title="model"
            current={modelKey}
            onchange={setModelKey}
            options={models}
          />
          {/* <DropDown title="type" current={interpolationTypeKey} onchange={setInterpolationTypeKey} options={interpolationTypes} /> */}
          <DropDown
            title="OutputViewType"
            current={outputViewTypeKey}
            onchange={setOutputViewTypeKey}
            options={outputViewTypes}
          />

          <Toggle title="onLocal" current={onLocal} onchange={setOnLocal} />
          <SingleValueSlider
            title="inputSize(w)"
            current={inputSize}
            onchange={setInputSize}
            min={240}
            max={720}
            step={240}
          />
          <Toggle title="SIMD" current={useSIMD} onchange={setUseSIMD} />
          <Toggle
            title="TensorflowJS"
            current={useTensorflowJS}
            onchange={setUseTensorflowJS}
          />

          {/* <Toggle title="applyToSrc" current={applyToSrc} onchange={setApplyToSrc} /> */}
          <Toggle
            title="calcScore"
            current={calcScore}
            onchange={setCalcScore}
          />

          {/* <Toggle title="setStartDataGen" current={startDataGen} onchange={setStartDataGen} /> */}
          <Toggle
            title="setStartEval"
            current={startEval}
            onchange={setStartEval}
          />

          <div>
            <a href="https://github.com/w-okada/image-analyze-workers">
              github repository
            </a>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "row" }}>
          <div
            style={{ display: "flex", flexDirection: "column", padding: "4px" }}
          >
            <div>(1) Input image</div>
            <div id="input_info" />
            <canvas id="original" />
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              padding: "4px",
              alignItems: "center",
            }}
          >
            <div>(2) Sent image(Low Res)</div>
            <div id="send_info" />
            <canvas id="to_be_sent"></canvas>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              padding: "4px",
              alignItems: "center",
            }}
          >
            <ForwardIcon />
            <div>transfer...</div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              padding: "4px",
              alignItems: "center",
            }}
          >
            <div>(3) Received image(Low Res)</div>
            <div id="receive_info" />
            <video id="received_video"></video>
          </div>

          <div
            style={{ display: "flex", flexDirection: "column", padding: "4px" }}
          >
            <div>(4) Recovered image</div>
            <div id="recover_info" />
            <canvas id="output_espcn"></canvas>　
            <div id="espcn_info" />
            <div id="eval_info" />
            <canvas id="output_cubic"></canvas>　
            <div id="cubic_info" />
            <canvas id="output_canvas"></canvas>　
            <div id="canvas_info" />
          </div>
        </div>
      </div>
      <div></div>
      <div>
        <img id="input_img" alt="" hidden></img>
        <video id="input_video" hidden></video>

        <audio id="audio-output" hidden />
        <canvas id="receive-canvas" hidden />
      </div>
    </div>
  );
}

export default App;
