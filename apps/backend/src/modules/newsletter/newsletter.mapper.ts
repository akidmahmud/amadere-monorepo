import { NewsletterStatus } from '@amader/db';

export class NewsletterSubscriberDto {
  id!: number;
  email!: string;
  status!: NewsletterStatus;
  subscribedAt!: Date;
  unsubscribedAt!: Date | null;
}
