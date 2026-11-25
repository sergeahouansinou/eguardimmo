<?php

declare(strict_types=1);

use App\Modules\OwnerFunds\Enums\PayoutItemStatus;
use App\Modules\OwnerFunds\Models\PayoutBatch;
use App\Modules\OwnerFunds\Models\PayoutItem;
use App\Modules\OwnerFunds\Support\PayoutCsv;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\OwnerFunds\OwnerFundsContext as F;

it('n\'ajoute pas d\'apostrophe à un montant négatif et neutralise le nom du mandant', function (): void {
    ['org' => $org, 'mandant' => $mandant] = F::agence($this);
    L::dans($org, fn () => DB::table('parties')->where('id', $mandant->id)->update(['display_name' => "\n=SOMME(A1)"]));

    $lot = new PayoutBatch(['number' => 'RV-2026-0001', 'currency' => 'EUR']);
    $ligne = new PayoutItem(['mandant_party_id' => $mandant->id, 'status' => PayoutItemStatus::Returned, 'currency' => 'EUR', 'bank_last4' => '4321']);
    $ligne->setRawAttributes([...$ligne->getAttributes(), 'net_amount' => -12500]);
    $lot->setRelation('items', collect([$ligne]));

    $csv = L::dans($org, fn (): string => app(PayoutCsv::class)->render($lot));

    expect($csv)->toContain(';-12500;"EUR";"4321";"returned"')->not->toContain("'-12500")->not->toContain('"-12500"')
        ->and($csv)->toContain("\"'=SOMME(A1)\"");
});
