import { Injectable } from "@nestjs/common";
import { estimateEta } from "./eta.util";
import type { EtaPredictionResult, EtaPredictor, EtaPredictorInput } from "./interfaces/eta-predictor.interface";

@Injectable()
export class HeuristicEtaPredictor implements EtaPredictor {
  predict(input: EtaPredictorInput): EtaPredictionResult {
    return estimateEta({ ...input, now: new Date() });
  }
}
