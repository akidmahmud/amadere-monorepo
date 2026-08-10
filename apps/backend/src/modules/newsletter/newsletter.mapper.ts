import { ApiProperty } from '@nestjs/swagger';
import { NewsletterStatus, NewsletterSubscriber, NewsletterSubscriberTag, NewsletterTag } from '@amader/db';

export class NewsletterSubscriberTagDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  name!: string;
}

export class NewsletterSubscriberDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  email!: string;

  @ApiProperty({ nullable: true })
  name!: string | null;

  @ApiProperty({ enum: ['SUBSCRIBED', 'UNSUBSCRIBED'] })
  status!: NewsletterStatus;

  @ApiProperty()
  subscribedAt!: Date;

  @ApiProperty({ nullable: true })
  unsubscribedAt!: Date | null;

  @ApiProperty({ type: () => NewsletterSubscriberTagDto, isArray: true })
  tags!: NewsletterSubscriberTagDto[];
}

type SubscriberWithTags = NewsletterSubscriber & {
  tags: (NewsletterSubscriberTag & { tag: NewsletterTag })[];
};

export function toNewsletterSubscriberDto(subscriber: SubscriberWithTags): NewsletterSubscriberDto {
  return {
    id: subscriber.id,
    email: subscriber.email,
    name: subscriber.name,
    status: subscriber.status,
    subscribedAt: subscriber.subscribedAt,
    unsubscribedAt: subscriber.unsubscribedAt,
    tags: subscriber.tags.map((t) => ({ id: t.tag.id, name: t.tag.name })),
  };
}
