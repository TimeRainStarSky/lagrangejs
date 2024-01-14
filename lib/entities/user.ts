import {Contactable} from "./contactable";
import {Client} from "../client";
import * as pb from "../core/protobuf/index";

export class User extends Contactable {
    protected constructor(c: Client) {
        super(c);
    }
}
