<?php

declare(strict_types=1);

namespace App\Modules\Identity\Data;

use Carbon\CarbonInterface;

final readonly class AccountFileData
{
    /**
     * @param  list<string>  $profileTypes
     */
    public function __construct(
        public string $id,
        public string $name,
        public ?string $email,
        public ?CarbonInterface $createdAt,
        public ?CarbonInterface $emailVerifiedAt,
        public ?CarbonInterface $lastLoginAt,
        public ?CarbonInterface $deletedAt,
        public bool $isOperator,
        public ?CarbonInterface $suspendedAt,
        public ?string $suspensionReason,
        public ?CarbonInterface $suspensionReviewedAt,
        public bool $twoFactorEnabled,
        public ?int $recoveryCodesRemaining,
        public int $devicesCount,
        public int $tokensCount,
        public array $profileTypes,
        public int $organizationsCount,
    ) {}
}
