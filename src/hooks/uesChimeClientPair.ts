import { ConsoleLogger, DefaultActiveSpeakerPolicy, DefaultDeviceController, DefaultMeetingSession, MeetingSessionConfiguration, VideoTileState } from "amazon-chime-sdk-js"
import { useEffect, useState } from "react"
import * as api from '../api/api'

interface UseChimeClinetPairProps{
    meetingRoom?:string,
    user1?:string,
    user2?:string
    audioOutputElement?:string
}

interface ChimeClientPairState{
    props:UseChimeClinetPairProps
    meetingSession1:DefaultMeetingSession|null
    meetingSession2:DefaultMeetingSession|null
}

export const useChimeClientPair = (props:UseChimeClinetPairProps) => {
    const [state, setState] = useState<ChimeClientPairState>({
        props:props,
        meetingSession1:null,
        meetingSession2:null,
    })
    const [ stateUpdateTime, setStateUpdateTime] = useState<number>(0)

    useEffect(()=>{
        const promises:Promise<any>[] = ["user1","user2"].map(async (user)=>{
            if(user==="user2"){ // avoid conflect create meeting.
                const p = new Promise<void>((resolve, reject)=>{
                    setTimeout(()=>{resolve()}, 1000*2)
                })
                await p
            }
            const userName = user==="user1"? props.user1||"user1" : props.user2||"user2"
            const meetingInfo = await api.joinMeeting(props.meetingRoom||"chime_test_001_sr", userName)
            // const logger = new ConsoleLogger('MeetingLogs', LogLevel.OFF)        
            const logger = new ConsoleLogger('MeetingLogs')
            const deviceController = new DefaultDeviceController(logger)
            deviceController.addDeviceChangeObserver({
                audioInputsChanged(_freshAudioInputDeviceList: MediaDeviceInfo[]): void {
                    console.log("audioInputsChanged", _freshAudioInputDeviceList)
                },
                audioOutputsChanged(_freshAudioOutputDeviceList: MediaDeviceInfo[]): void {
                    console.log("audioOutputsChanged", _freshAudioOutputDeviceList)
                },
                videoInputsChanged(_freshVideoInputDeviceList: MediaDeviceInfo[]): void {
                    console.log("videoInputsChanged", _freshVideoInputDeviceList)
                }
            })
            const configuration = new MeetingSessionConfiguration(meetingInfo.JoinInfo.Meeting, meetingInfo.JoinInfo.Attendee)
            const meetingSession = new DefaultMeetingSession(configuration, logger, deviceController)
            meetingSession.audioVideo.addObserver({
                // audioVideoDidStartConnecting(reconnecting: boolean): void {}
                // audioVideoDidStart(): void {}
                // audioVideoDidStop(sessionStatus: MeetingSessionStatus): void {}
                videoTileDidUpdate(tileState: VideoTileState): void {
                    console.log(`[DEBUG] [${user}] tile added`)
                    setStateUpdateTime(new Date().getTime())
                },
                videoTileWasRemoved(tileId: number): void {
                    console.log(`[DEBUG] [${user}] tile removed`)
                    setStateUpdateTime(new Date().getTime())
                },
                // videoAvailabilityDidChange(availability: MeetingSessionVideoAvailability): void {}

                ////// videoSendHealthDidChange
                ////// videoSendBandwidthDidChange
                ////// videoReceiveBandwidthDidChange

                estimatedDownlinkBandwidthLessThanRequired(estimatedDownlinkBandwidthKbps: number, requiredVideoDownlinkBandwidthKbps: number): void {
                    console.log(`[PFM] [${user}] Estimated downlink bandwidth is ${estimatedDownlinkBandwidthKbps} is less than required bandwidth for video ${requiredVideoDownlinkBandwidthKbps}`)
                }
                ////// videoNotReceivingEnoughData?(receivingDataMap
                //metricsDidReceive(clientMetricReport: ClientMetricReport): void {}
                ////// connectionHealthDidChange
                //// connectionDidBecomePoor(): void {}
                //// connectionDidSuggestStopVideo(): void {}
                ///// videoSendDidBecomeUnavailable(): void {}
            })
            meetingSession.audioVideo.realtimeSubscribeToAttendeeIdPresence((attendeeId: string, present: boolean) => {
                console.log(`[${user}] attendeeIdPresenceSubscriber ${attendeeId} present = ${present}`);
            })
            meetingSession.audioVideo.subscribeToActiveSpeakerDetector(
                new DefaultActiveSpeakerPolicy(),
                (attendeeIds: string[]) => {
                    console.log(`[${user}] activeSpeakerDetectorSubscriber ${attendeeIds}`);
                },
                scores => {
                    //console.log("subscribeToActiveSpeakerDetector", scores)
                },100
            )

            ///// Dummy Audio Input
            const audioContext = DefaultDeviceController.getAudioContext();
            const dummyOutputNode = audioContext.createMediaStreamDestination();
            const gainNode = audioContext.createGain();
            gainNode.gain.value = 1.0;
            gainNode.connect(dummyOutputNode);
            const oscillatorNode = audioContext.createOscillator();
            oscillatorNode.frequency.value = 440;
            oscillatorNode.connect(gainNode);
            oscillatorNode.start();
            const inputMediaStream = dummyOutputNode.stream

            await meetingSession.deviceController.listAudioInputDevices()
            const audioOuts = await meetingSession.deviceController.listAudioOutputDevices()

            await meetingSession.audioVideo.chooseAudioInputDevice(inputMediaStream)
            await meetingSession.audioVideo.chooseAudioInputDevice(audioOuts[0])
            const audioOutputElement = document.getElementById(props.audioOutputElement||'audio-output') as HTMLAudioElement;              
            await meetingSession.audioVideo.bindAudioElement(audioOutputElement);
            audioOutputElement.volume = 0.01
            meetingSession.audioVideo.start()
            // meetingSession.audioVideo.startLocalVideoTile()
            console.log(`[DEBUG] [${user}] meeting session create!`)
            return meetingSession
        })

        Promise.all(promises).then(([s1, s2])=>{
            console.log("[DEBUG] promise is resolved")
            setState({...state, meetingSession1:s1, meetingSession2:s2})
        })


    },[])
    return { ...state, stateUpdateTime }
}