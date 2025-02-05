import fetch from "node-fetch";
import {version} from "../package.json";
import {
    ApplicationLogSubTypes,
    DeviceSubTypes,
    ElevatorCallSubTypes,
    EMSSubTypes,
    EtceteraSubTypes,
    GuardSubTypes,
    HealthcareSubTypes,
    InfoSubTypes,
    LoginSubTypes,
    SettingSubTypes,
    SystemSubTypes,
    Types
} from "./fields";
import {Complex, ComplexInfo} from "./interfaces/complex";
import * as fs from "fs";
import {MenuItem} from "./interfaces/menu";
import axios from "axios";

export interface SemanticVersion {
    major: number,
    minor: number,
    patch: number,
    beta: number,
    toString(): string,
    isNewerThan(spec: SemanticVersion): boolean,
}

export class Semaphore {

    public static readonly FILENAME = 'daelim-semaphore';

    private getFilePath() {
        return `${process.cwd()}/${Semaphore.FILENAME}`;
    }

    public createSemaphore() {
        if(this.isLocked()) {
            return;
        }
        fs.openSync(this.getFilePath(), 'w');
    }

    public removeSemaphore() {
        if(!this.isLocked()) {
            return;
        }
        fs.unlinkSync(this.getFilePath());
    }

    public isLocked() {
        return fs.existsSync(this.getFilePath());
    }

}

export class Utils {

    public static PLUGIN_NAME = "homebridge-daelim-smarthome";
    public static PLATFORM_NAME = "DaelimSmartHomePlatform";
    public static MANUFACTURER_NAME = "DL E&C Co.,Ltd.";
    public static FCM_SENDER_ID = "251248256994";

    public static COMPLEX_URL = "https://raw.githubusercontent.com/jinyoungyou/homebridge-daelim-smarthome/master/complexes/complexes.json";
    public static HOMEKIT_SECURE_VIDEO_IDLE_URL = "https://raw.githubusercontent.com/OrigamiDream/homebridge-daelim-smarthome/master/assets/hksv_camera_idle.png";
    public static MENU_INFO_URL = "https://smarthome.daelimcorp.co.kr/json/getApartMenuInfo.do";

    static createSemanticVersion(major: number, minor: number, patch: number, beta: number = -1): SemanticVersion {
        return {
            major, minor, patch, beta,
            toString(): string {
                let string = major + "." + minor + "." + patch;
                if(beta !== -1) {
                    string += "-beta." + beta;
                }
                return string;
            },
            isNewerThan(spec: SemanticVersion): boolean {
                const a = [this.major, this.minor, this.patch]
                const b = [spec.major, spec.minor, spec.patch]
                for(let i = 0; i < a.length; i++) {
                    if(a[i] > b[i]) {
                        return true;
                    } else if (a[i] < b[i]) {
                        return false;
                    }
                }
                if(this.beta === -1 && spec.beta !== -1) {
                    // 1.0.0 > 1.0.0-beta.1 == true
                    return true;
                } else if(this.beta !== -1 && spec.beta === -1) {
                    // 1.0.0-beta.1 > 1.0.0 == false
                    return false;
                } else if(this.beta !== -1 && spec.beta !== -1 && this.beta > spec.beta) {
                    // 1.0.0-beta.2 > 1.0.0-beta.1 == true
                    return true;
                }
                return false;
            }
        };
    }

    static parseSemanticVersion(version: string): SemanticVersion {
        let beta = -1;
        if(version.indexOf("-beta.") !== -1) {
            const splits = version.split("-beta.");
            version = splits[0];
            beta = parseInt(splits[1]);
        }
        const splits = version.split(".");
        return Utils.createSemanticVersion(
            parseInt(splits[0]),
            parseInt(splits[1]),
            parseInt(splits[2]),
            beta
        );
    }

    static currentSemanticVersion(): SemanticVersion {
        return Utils.parseSemanticVersion(version);
    }

    static arraycopy(src: Uint8Array, srcPos: number, dst: Uint8Array, dstPos: number, length: number) {
        for(let i = 0; i < length; i++) {
            dst[dstPos + i] = src[srcPos + i];
        }
    }

    static async fetchComplexInfo(): Promise<ComplexInfo> {
        return await fetch(this.COMPLEX_URL)
            .then(response => response.json() as ComplexInfo | any)
            .catch(reason => {
                console.error('Failed to parse complex info:');
                console.error(reason);
                return {
                    complexes: []
                }
            });
    }

    static async fetchSupportedMenus(complex: Complex): Promise<MenuItem[]> {
        const params = {
            apartId: complex.apartId,
            searchMenuGubun: "mobile"
        };
        const queryString = new URLSearchParams(params).toString();
        return await axios.post(`${this.MENU_INFO_URL}?${queryString}`, undefined, {
            responseType: "json"
        }).then((response) => {
            return response.data;
        }).then((data: any) => {
            const items: MenuItem[] = [];
            for(const item of data["item"]) {
                if(item["menuGubun"] !== "mobile") {
                    continue;
                }
                items.push({
                    menuName: item["menuName"],
                    supported: item["useYn"] == "Y"
                });
            }
            return items;
        });
    }

    static async findMatchedComplex(regionName: string, complexName: string): Promise<Complex> {
        const info = await Utils.fetchComplexInfo();
        const regions = info.complexes;
        if(regions.length == 0) {
            throw new Error('No regions are available');
        }

        const complexes = regions
            .filter(region => region.region == regionName)
            .flatMap(region => region.complexes);
        if(complexes.length == 0) {
            throw new Error('No complexes are available');
        }

        const buildings = complexes
            .filter(complex => complex.name == complexName);
        if(buildings.length == 0) {
            throw new Error('No matched buildings are available');
        }
        return buildings[0];
    }

    static findSubType(type: Types) {
        switch (type) {
            case Types.SYSTEM:
                return SystemSubTypes;
            case Types.LOGIN:
                return LoginSubTypes;
            case Types.GUARD:
                return GuardSubTypes;
            case Types.DEVICE:
                return DeviceSubTypes;
            case Types.EMS:
                return EMSSubTypes;
            case Types.INFO:
                return InfoSubTypes;
            case Types.HEALTHCARE:
                return HealthcareSubTypes;
            case Types.SETTING:
                return SettingSubTypes;
            case Types.ELEVATOR_CALL:
                return ElevatorCallSubTypes;
            case Types.ETCETERA:
                return EtceteraSubTypes;
            case Types.APPLICATION_LOG:
                return ApplicationLogSubTypes;
            default:
                throw `Invalid SubTypes${type}`;
        }
    }

}