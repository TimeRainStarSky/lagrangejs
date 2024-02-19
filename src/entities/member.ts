import { User } from "./user";
import {Client} from "../client";
import {lock} from "../core/constants";
import * as pb from "../core/protobuf"
import {MemberInfo} from "../entities";
import {drop} from "../errors";
import {Quotable, Sendable} from "../message/elements";
import {MessageRet} from "../events";
const memberCache:WeakMap<MemberInfo,Member>=new WeakMap<MemberInfo,Member>()
export class Member extends User {

    protected constructor(c: Client, public readonly gid: number,uin:number) {
        super(c,uin);
        this.uid=c.memberList.get(gid)?.get(uin)?.uid
        lock(this, "uid");
        lock(this, "gid");
    }
    get isFriend(){
        return !!this.c.friendList.get(this.uin)
    }
    static from(this:Client,gid: number,uid:number):Member {
        const memberInfo=this.memberList.get(gid)?.get(uid)
        if(!memberInfo) throw new Error(`Group(${gid}) not exist or Member(${uid}) not found`)
        let member=memberCache.get(memberInfo)
        if(member) return member
        memberCache.set(memberInfo,member=new Member(this,gid,uid))
        return member
    }
    async mute(duration: number) {
        const body = pb.encode({
            1: this.gid,
            2: 1,
            3: {
                1: this.uid,
                2: duration
            }
        });
        const packet = await this.c.sendOidbSvcTrpcTcp(0x1253, 1, body);
        const rsp = pb.decode(packet);
        return !rsp[3];
    }

    async kick(rejectAddition: boolean) {
        const body = pb.encode({
            1: this.gid,
            3: this.uid,
            4: rejectAddition,
            5: ""
        });
        const packet = await this.c.sendOidbSvcTrpcTcp(0x8a0, 1, body);
        const rsp = pb.decode(packet);
        return !rsp[3];
    }

    async setAdmin(isAdmin?: boolean) {
        const body = pb.encode({
            1: this.gid,
            2: this.uid,
            3: isAdmin
        });
        const packet = await this.c.sendOidbSvcTrpcTcp(0x8a0, 1, body);
        const rsp = pb.decode(packet);
        return !rsp[3];
    }

    /**
     * 设为群主
     */
    async setOwner(){
        const body = pb.encode({
            1: this.gid,
            2: this.c.uid,
            3: this.uid
        });
        const packet = await this.c.sendOidbSvcTrpcTcp(0x89e, 0, body);
        const rsp = pb.decode(packet);
        return!rsp[3];
    }
    async sendMsg(content: Sendable, source?: Quotable): Promise<MessageRet>{
        if(this.isFriend) return this.asFriend().sendMsg(content,source) // 是好友，直接走私聊
        const { rich, brief } = await this._preprocess(content,source);
        const seq = this.c.sig.seq + 1;
        const rsp = await this._sendMsg({ 1: rich })
        if (rsp[1] !== 0) {
            this.c.logger.error(`failed to send: [Temp(${this.uin}) of Group(${this.gid})] ${rsp[2]}(${rsp[1]})`);
            drop(rsp[1], rsp[2]);
        }
        this.c.logger.info(`succeed to send: [Temp(${this.uin}) of Group(${this.gid})] ` + brief);
        const time = rsp[3];
        return { seq, time }
    }
    async renameGroupMember(targetName: string) {
        const body = pb.encode({
            1: this.gid,
            3: {
                1: this.uid,
                8: targetName
            }
        });
        const packet = await this.c.sendOidbSvcTrpcTcp(0x8fc, 3, body);
        const rsp = pb.decode(packet);
        return !rsp[3];
    }
}
