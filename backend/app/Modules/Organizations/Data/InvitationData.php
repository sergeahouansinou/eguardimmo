<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Data;

use App\Modules\Organizations\Enums\MemberRole;

final readonly class InvitationData
{
    public function __construct(
        public string $email,
        public string $firstName,
        public string $lastName,
        public MemberRole $role,
        public MemberScopeData $scope,
        public ?string $message,
    ) {}
}
