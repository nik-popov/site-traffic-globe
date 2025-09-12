// shared.ts (or wherever OutgoingMessage is defined)
export interface Position {
  lat: number;
  lng: number;
  id: string;
}

export type OutgoingMessage =
  | {
      type: "add-marker";
      position: Position;
    }
  | {
      type: "remove-marker";
      id: string;
    }
  | {
      type: "room-update";
      roomId: string;
      userCount: number;
    }
  | {
      type: "chat-message";
      id: string;
      text: string;
      timestamp: string;
    };