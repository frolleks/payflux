import { Payflux } from "@payflux/server";
import { getProcessorBaseUrl } from "./paywallStore";

const processorBase = getProcessorBaseUrl();
export const payflux = new Payflux(processorBase);
