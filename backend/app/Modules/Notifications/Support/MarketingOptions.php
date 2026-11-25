<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Support;

use App\Modules\Notifications\Enums\MarketingAudience;
use App\Modules\Notifications\Enums\MarketingCategory;
use App\Modules\Notifications\Enums\MarketingChannel;
use App\Modules\Notifications\Push\PushChannel;

final readonly class MarketingOptions
{
    public const int SUBJECT = 140;

    public const int PUSH_TITLE = 65;

    public const int PUSH_BODY = 240;

    public const int SELECTED_RECIPIENTS = 500;

    public function __construct(
        private MailProvider $fournisseur,
        private PushChannel $push,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function all(): array
    {
        $email = $this->fournisseur->enabled();
        $push = $this->push->enabled();

        return [
            'channels' => [
                ['channel' => MarketingChannel::Email->value, 'enabled' => $email, 'reason' => $email ? null : 'L\'envoi d\'e-mails n\'est pas configuré sur la plateforme.'],
                ['channel' => MarketingChannel::Push->value, 'enabled' => $push, 'reason' => $push ? null : 'Les notifications mobiles ne sont pas activées sur la plateforme.'],
            ],
            'categories' => array_map(fn (MarketingCategory $categorie): array => [
                'code' => $categorie->value,
                'label' => $categorie->label(),
                'description' => $categorie->description(),
            ], MarketingCategory::cases()),
            'audiences' => array_map(fn (MarketingAudience $groupe): array => [
                'code' => $groupe->value,
                'label' => $groupe->label(),
                'description' => $groupe->description(),
                'accepts_inactivity_days' => $groupe->acceptsInactivityDays(),
            ], MarketingAudience::cases()),
            'limits' => [
                'subject' => self::SUBJECT,
                'push_title' => self::PUSH_TITLE,
                'push_body' => self::PUSH_BODY,
                'html_bytes' => CampaignHtml::MAX_BYTES,
                'images' => CampaignImageFiles::MAX_IMAGES,
                'image_bytes' => CampaignImageFiles::MAX_BYTES,
                'total_image_bytes' => CampaignImageFiles::MAX_TOTAL_BYTES,
                'selected_recipients' => self::SELECTED_RECIPIENTS,
            ],
        ];
    }
}
