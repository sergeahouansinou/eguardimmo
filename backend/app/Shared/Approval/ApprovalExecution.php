<?php

declare(strict_types=1);

namespace App\Shared\Approval;

final readonly class ApprovalExecution
{
    /**
     * @param  array<string, mixed>  $payload
     */
    public function __construct(
        public string $approvalId,
        public string $action,
        public string $subjectId,
        public ?string $organizationId,
        public array $payload,
        public string $requestedByUserId,
        public ?string $decidedByUserId,
    ) {}
}
