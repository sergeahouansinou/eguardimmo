<?php

declare(strict_types=1);

use App\Modules\Invoicing\Models\Invoice;
use App\Modules\Parties\Models\Party;
use Tests\Feature\Invoicing\InvoicingContext as C;
use Tests\Feature\Leases\LeasesContext as L;

beforeEach(function (): void {
    C::preparer($this);
    $this->org = C::organisation();
    $this->partie = C::destinataire($this->org);
    $this->actingAs(L::titulaire($this->org));
});

it('l\'instantané et l\'empreinte restent ceux de l\'émission après modification de la partie et de l\'émetteur', function (): void {
    $facture = C::emettre($this, $this->org, $this->partie);
    $avant = L::dans($this->org, fn () => Invoice::query()->find($facture->id)->only(['snapshot', 'fingerprint', 'stored_file_id']));

    L::dans($this->org, fn () => Party::query()->whereKey($this->partie->id)->update(['display_name' => 'Nouveau Nom', 'address' => json_encode(['line1' => 'Ailleurs', 'postal_code' => '00000', 'city' => 'Nulle part', 'country' => 'FR'])]));
    C::identite($this->org);

    $apres = L::dans($this->org, fn () => Invoice::query()->find($facture->id)->only(['snapshot', 'fingerprint', 'stored_file_id']));

    expect($apres)->toBe($avant)
        ->and($avant['snapshot']['recipient']['name'])->not->toBe('Nouveau Nom')
        ->and($avant['snapshot']['issuer']['siren'])->toBe('552100554')
        ->and($avant['snapshot']['number'])->toBe($facture->number)
        ->and($avant['snapshot']['amounts'])->toBe(['net' => 10000, 'tax' => 2000, 'gross' => 12000]);
});

it('l\'avoir cite le numéro et la date de la facture d\'origine', function (): void {
    $facture = C::emettre($this, $this->org, $this->partie);
    $id = $this->postJson(C::url($this->org, "/{$facture->id}/credit-notes"), ['reason' => 'Erreur', 'full' => true, 'idempotency_key' => 'avoir-instantane'])->assertCreated()->json('data.id');

    $instantane = L::dans($this->org, fn () => Invoice::query()->find($id)->snapshot);

    expect($instantane['references']['credited_invoice'])->toBe(['id' => $facture->id, 'number' => 'FA-2026-0001', 'issued_on' => '2026-11-18'])
        ->and($instantane['credit_reason'])->toBe('Erreur')
        ->and($instantane['recipient']['name'])->toBe($this->partie->display_name);
});
