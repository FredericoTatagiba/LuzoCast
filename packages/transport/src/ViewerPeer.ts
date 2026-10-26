import type { IceCandidate } from '@luzocast/signaling';
import { PeerConnectionFactory } from './PeerConnectionFactory';

export interface ViewerPeerCallbacks {
  onStream: (stream: MediaStream) => void;
  onIce: (candidate: IceCandidate) => void;
  onAnswer: (sdp: string) => void;
  onStateChange?: (state: RTCPeerConnectionState) => void;
}

/**
 * Lado do ESPECTADOR: só recebe. Responde ao offer do host e entrega o MediaStream.
 */
export class ViewerPeer {
  private readonly pc: RTCPeerConnection;
  private readonly pendingIce: IceCandidate[] = [];

  constructor(
    private readonly cb: ViewerPeerCallbacks,
    factory = new PeerConnectionFactory(),
  ) {
    this.pc = factory.create();
    this.pc.ontrack = (e) => {
      const stream = e.streams[0] ?? new MediaStream([e.track]);
      cb.onStream(stream);
    };
    this.pc.onicecandidate = (e) => {
      if (e.candidate) cb.onIce(e.candidate.toJSON() as IceCandidate);
    };
    this.pc.onconnectionstatechange = () => cb.onStateChange?.(this.pc.connectionState);
  }

  async handleOffer(sdp: string): Promise<void> {
    await this.pc.setRemoteDescription({ type: 'offer', sdp });
    // ICE que chegou antes do offer
    for (const c of this.pendingIce.splice(0)) await this.pc.addIceCandidate(c);
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    this.cb.onAnswer(this.pc.localDescription?.sdp ?? answer.sdp ?? '');
  }

  async handleIce(candidate: IceCandidate): Promise<void> {
    if (!this.pc.remoteDescription) {
      this.pendingIce.push(candidate);
      return;
    }
    await this.pc.addIceCandidate(candidate);
  }

  close(): void {
    this.pc.close();
  }
}
