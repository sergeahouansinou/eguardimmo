<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Data;

use App\Modules\Maintenance\Enums\ApprovalDecision;

final readonly class ApprovalDecisionData
{
    public function __construct(
        public ApprovalDecision $decision,
        public ?string $comment,
        public ?string $proofFileId,
    ) {}
}
