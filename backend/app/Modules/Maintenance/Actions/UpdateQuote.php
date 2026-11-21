<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Actions;

use App\Modules\Maintenance\Data\QuoteInputData;
use App\Modules\Maintenance\Enums\ErrorCode;
use App\Modules\Maintenance\Enums\QuoteStatus;
use App\Modules\Maintenance\Models\InterventionQuote;
use App\Modules\Maintenance\Support\Locks;
use App\Modules\Maintenance\Support\QuoteWriter;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final readonly class UpdateQuote
{
    public function __construct(
        private Locks $verrous,
        private QuoteWriter $redacteur,
    ) {}

    /**
     * Un devis ne se modifie que tant qu'il est `received` : dès qu'il est soumis, c'est ce que le mandant a vu.
     */
    public function handle(string $interventionId, string $quoteId, QuoteInputData $donnees): InterventionQuote
    {
        return DB::transaction(function () use ($interventionId, $quoteId, $donnees): InterventionQuote {
            $intervention = $this->verrous->intervention($interventionId);
            $devis = (Str::isUuid($quoteId) ? InterventionQuote::query()->whereKey($quoteId)->where('intervention_id', $interventionId)->lockForUpdate()->first() : null)
                ?? throw ErrorCode::QuoteNotFound->problem();

            if ($devis->status !== QuoteStatus::Received) {
                throw ErrorCode::QuoteFrozen->problem();
            }

            $ecriture = $this->redacteur->fill($intervention, $donnees, $devis);
            $devis->forceFill([...$ecriture['fields'], 'lock_version' => $devis->lock_version + 1])->save();
            $this->redacteur->writeLines($devis, $ecriture['lines']);

            return $devis;
        });
    }
}
