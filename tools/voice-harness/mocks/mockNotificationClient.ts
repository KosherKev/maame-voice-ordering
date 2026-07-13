import { NotificationClient } from '../../../src/integrations/index.js';

export class MockNotificationClient implements NotificationClient {
  public mockActions: any[] = [];

  async sendSms(recipient: string, message: string): Promise<void> {
    const action = { type: 'vendor_sms_logged', recipient, message };
    console.log('[MockNotificationClient]', action);
    this.mockActions.push(action);

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}
