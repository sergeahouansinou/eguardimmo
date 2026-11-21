<?php

declare(strict_types=1);

namespace App\Modules\Privacy\Data;

use Carbon\CarbonInterface;

final readonly class ConsolePrivacyRequestData
{
    /**
     * @param  list<array{kind: string, occurred_at: string, actor_id: string|null}>|null  $events
     */
    public function __construct(
        public string $id,
        public string $kind,
        public string $channel,
        public string $status,
        public CarbonInterface $receivedAt,
        public CarbonInterface $dueAt,
        public ?CarbonInterface $extendedUntil,
        public ?string $extensionReason,
        public CarbonInterface $deadline,
        public bool $overdue,
        public ?string $identityVerifiedBy,
        public ?CarbonInterface $identityVerifiedAt,
        public ?string $accountId,
        public ?string $requesterName,
        public ?string $requesterEmail,
        public int $forwardedCount,
        public int $forwardsHandled,
        public ?string $refusalReason,
        public ?CarbonInterface $completedAt,
        public bool $exportGenerated,
        public ?CarbonInterface $exportExpiresAt,
        public bool $exportDownloaded,
        public ?array $events = null,
    ) {}
}
