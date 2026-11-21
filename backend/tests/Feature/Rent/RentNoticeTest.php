<?php

declare(strict_types=1);

use App\Modules\Accounting\PublicApi\LedgerReader;
use App\Modules\Documents\Models\IssuedDocument;
use App\Modules\Organizations\Enums\OrganizationKind;
use App\Modules\Rent\Enums\InstallmentStatus;
use App\Modules\Rent\Models\Installment;
use App\Modules\Rent\Models\RentNotice;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Money\Currency;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Rent\RentContext as C;

beforeEach(function (): void {
    C::preparer($this);
});

it('émet l\'avis d\'échéance : numéro continu, PDF Gotenberg figé, appel de loyer au grand livre', function (OrganizationKind $type): void {
    $org = C::organisation($type);
    ['bail' => $bail] = C::bail($org);
    C::generer($org, $bail);
    [$echeance] = C::echeances($org, $bail);
    $this->actingAs(L::titulaire($org));

    $reponse = $this->postJson(C::url($org, "/installments/{$echeance->id}/issue"))->assertOk();

    $reponse->assertJsonPath('data.status', 'issued')
        ->assertJsonPath('data.notice.number', 'AV-2026-0001')
        ->assertJsonPath('data.amounts.total.amount', 70000)
        ->assertJsonPath('data.amounts.total.currency', 'EUR')
        ->assertJsonPath('data.outstanding.amount', 70000)
        ->assertJsonPath('data.receipt_state', 'not_due');

    Http::assertSent(fn (Request $r): bool => $r->url() === 'http://gotenberg.test/forms/chromium/convert/html' && $r->isMultipart());

    L::dans($org, function () use ($echeance, $bail): void {
        $avis = RentNotice::query()->where('installment_id', $echeance->id)->firstOrFail();
        $piece = IssuedDocument::query()->findOrFail($avis->issued_document_id);

        expect($avis->snapshot['amounts'])->toBe(['rent' => 65000, 'charges' => 5000, 'vat' => 0, 'total' => 70000])
            ->and($avis->snapshot['issuer']['name'])->toBe('Agence du Port')
            ->and($avis->snapshot['template_version'])->toBe($avis->template_version)
            ->and($piece->fingerprint)->toBe($avis->fingerprint)
            ->and(Installment::query()->findOrFail($echeance->id)->ledger_entry_id)->not->toBeNull()
            ->and(app(LedgerReader::class)->dueByLease($bail->id, new Currency('EUR'))->getAmount())->toBe('70000');
    });
})->with([OrganizationKind::Agency, OrganizationKind::Individual]);

it('rejouer l\'émission ne double ni l\'avis ni l\'écriture', function (): void {
    $org = C::organisation();
    ['bail' => $bail] = C::bail($org);
    C::generer($org, $bail);
    [$echeance] = C::echeances($org, $bail);
    $this->actingAs(L::titulaire($org));

    $this->postJson(C::url($org, "/installments/{$echeance->id}/issue"))->assertOk();
    $this->postJson(C::url($org, "/installments/{$echeance->id}/issue"))->assertOk()->assertJsonPath('data.notice.number', 'AV-2026-0001');

    expect(L::dans($org, fn () => RentNotice::query()->count()))->toBe(1)
        ->and(C::du($org, $bail))->toBe(70000);
});

it('sans Gotenberg, l\'émission échoue en 503 et ne laisse ni avis ni écriture', function (): void {
    $org = C::organisation();
    ['bail' => $bail] = C::bail($org);
    C::generer($org, $bail);
    [$echeance] = C::echeances($org, $bail);
    C::$panneGotenberg = true;
    $this->actingAs(L::titulaire($org));

    $this->postJson(C::url($org, "/installments/{$echeance->id}/issue"))
        ->assertStatus(503)->assertJsonPath('code', 'rent_pdf_unavailable')->assertHeader('Retry-After', '30');

    expect(L::dans($org, fn () => RentNotice::query()->count()))->toBe(0)
        ->and(L::dans($org, fn () => Installment::query()->findOrFail($echeance->id)->status))->toBe(InstallmentStatus::Upcoming)
        ->and(C::du($org, $bail))->toBe(0);
});

it('émet en lot les avis dont la date est atteinte et rapporte les échecs sans arrêter les autres', function (): void {
    $org = C::organisation();
    ['bail' => $bail] = C::bail($org);
    C::generer($org, $bail);
    C::generer($org, $bail, '2026-11-25');
    $this->travelTo('2026-11-25 10:00:00');
    $this->actingAs(L::titulaire($org));

    $this->postJson(C::url($org, '/installments/issue-due'), ['limit' => 1])
        ->assertOk()->assertJsonPath('data.issued', 1)->assertJsonPath('data.remaining', true);
    $this->postJson(C::url($org, '/installments/issue-due'))
        ->assertOk()->assertJsonPath('data.issued', 1)->assertJsonPath('data.remaining', false);

    expect(array_map(fn (Installment $e): string => $e->status->value, C::echeances($org, $bail)))->toBe(['issued', 'issued'])
        ->and(C::du($org, $bail))->toBe(140000);
});

it('rapporte un code d\'échec stable, sans nom de classe interne, quand le PDF est indisponible', function (): void {
    $org = C::organisation();
    ['bail' => $bail] = C::bail($org);
    C::generer($org, $bail);
    $this->travelTo('2026-11-25 10:00:00');
    $this->actingAs(L::titulaire($org));
    C::$panneGotenberg = true;

    $reponse = $this->postJson(C::url($org, '/installments/issue-due'))->assertOk()->assertJsonPath('data.issued', 0);

    expect($reponse->json('data.failed.0.error'))->toBe('issuance_failed')
        ->and($reponse->getContent())->not->toContain('Exception');
});

it('télécharge l\'avis en PDF privé, et refuse l\'avis d\'une échéance non émise', function (): void {
    $org = C::organisation();
    ['bail' => $bail] = C::bail($org);
    C::generer($org, $bail);
    [$echeance] = C::echeances($org, $bail);
    $this->actingAs(L::titulaire($org));

    $this->get(C::url($org, "/installments/{$echeance->id}/notice/download"))->assertNotFound()->assertJsonPath('code', 'rent_notice_not_found');
    $this->postJson(C::url($org, "/installments/{$echeance->id}/issue"))->assertOk();

    $this->get(C::url($org, "/installments/{$echeance->id}/notice/download"))
        ->assertOk()->assertHeader('Content-Type', 'application/pdf');
});

it('annule une échéance émise sans encaissement : l\'appel de loyer est contrepassé et la période reste prise', function (): void {
    $org = C::organisation();
    ['bail' => $bail] = C::bail($org);
    C::generer($org, $bail);
    [$echeance] = C::echeances($org, $bail);
    $this->actingAs(L::titulaire($org));
    $this->postJson(C::url($org, "/installments/{$echeance->id}/issue"))->assertOk();

    $this->postJson(C::url($org, "/installments/{$echeance->id}/cancel"), ['reason' => 'Émise par erreur'])
        ->assertOk()->assertJsonPath('data.status', 'cancelled');

    expect(C::du($org, $bail))->toBe(0)
        ->and(C::generer($org, $bail))->toBe(['created' => 0, 'existing' => 1])
        ->and(C::echeances($org, $bail))->toHaveCount(1);
});
