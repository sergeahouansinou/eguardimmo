<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Actions;

use App\Modules\Organizations\Data\MemberScopeData;
use App\Modules\Organizations\Enums\ErrorCode;
use App\Modules\Organizations\Enums\ScopeType;
use App\Shared\Audit\RecordAudit;

final readonly class RefuseUnsupportedScope
{
    public function __construct(private RecordAudit $audit) {}

    public function handle(?MemberScopeData $perimetre): void
    {
        if ($perimetre === null || $perimetre->type !== ScopeType::Selected) {
            return;
        }

        $this->audit->handle('organizations.member.scope_refused', metadata: [
            'scope_type' => $perimetre->type->value,
            'property_count' => count($perimetre->propertyIds),
        ]);

        throw ErrorCode::MemberScopeUnsupported->problem();
    }
}
