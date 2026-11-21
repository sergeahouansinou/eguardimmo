<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Data;

use Carbon\CarbonInterface;

final readonly class ConsoleOrganizationData
{
    /**
     * @param  array{first_name: string, last_name: string, account_id: string|null}|null  $owner
     */
    public function __construct(
        public string $id,
        public string $name,
        public string $kind,
        public string $country,
        public CarbonInterface $createdAt,
        public ?CarbonInterface $suspendedAt,
        public ?string $suspensionReason,
        public bool $twoFactorRequired,
        public int $membersCount,
        public ?string $plan,
        public ?string $subscriptionStatus,
        public ?array $owner,
        public bool $detailed,
    ) {}
}
