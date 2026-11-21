<?php

declare(strict_types=1);

namespace App\Modules\Charges\Actions;

use App\Modules\Charges\Enums\ErrorCode;
use App\Modules\Charges\Enums\StatementStatus;
use App\Modules\Charges\Models\ChargeStatement;
use App\Modules\Charges\Support\IssuanceOutcome;
use App\Shared\Http\ApiProblem;

final readonly class RetryStatement
{
    public function __construct(
        private IssueStatement $emission,
        private IssuanceOutcome $suites,
    ) {}

    /**
     * Reprend l'émission d'un décompte en panne ; rejouable : un décompte déjà émis est renvoyé tel quel, sans second effet.
     */
    public function handle(string $statementId): ChargeStatement
    {
        $decompte = ChargeStatement::query()->whereKey($statementId)->first() ?? throw ErrorCode::StatementNotFound->problem();

        if ($decompte->status === StatementStatus::Issued) {
            return $decompte;
        }

        if ($decompte->status !== StatementStatus::Failed) {
            throw ErrorCode::StatementStateInvalid->problem('Seul un décompte en panne se reprend.');
        }

        try {
            $emis = $this->emission->handle($decompte->id);
        } catch (ApiProblem $erreur) {
            $this->suites->markFailed($decompte->id, $erreur->problemCode);

            throw $erreur;
        }

        $this->suites->finalize($decompte->exercise_id);

        return $emis;
    }
}
