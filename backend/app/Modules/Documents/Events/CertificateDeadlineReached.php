<?php

declare(strict_types=1);

namespace App\Modules\Documents\Events;

use App\Modules\Documents\Enums\CertificateState;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Une pièce à échéance entre dans sa période de rappel (`ToRenew`) ou expire (`Expired`) ; réémis par le balayage
 * quotidien pendant les jours qui suivent, le consommateur dédoublonne (ADR 0027).
 */
final readonly class CertificateDeadlineReached implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(
        public string $certificateId,
        public string $organizationId,
        public CertificateState $state,
        public string $expiresOn,
        public string $typeLabel,
        public ?string $subjectType = null,
        public ?string $subjectId = null,
    ) {}
}
