<?php

declare(strict_types=1);

use App\Modules\Invoicing\Mail\InvoiceMail;
use App\Modules\Invoicing\Models\Invoice;
use App\Shared\Audit\AuditLog;
use Illuminate\Mail\MailManager;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Mail;
use Tests\Feature\Documents\DocumentsContext;
use Tests\Feature\Invoicing\InvoicingContext as C;
use Tests\Feature\Leases\LeasesContext as L;

beforeEach(function (): void {
    C::preparer($this);
    $this->org = C::organisation();
    $this->partie = C::destinataire($this->org);
    $this->actingAs(L::titulaire($this->org));
});

it('un échec de l\'audit annule l\'horodatage d\'envoi et ne met aucun e-mail en file', function (): void {
    Mail::fake();
    $facture = C::emettre($this, $this->org, $this->partie);
    Event::listen('eloquent.creating: '.AuditLog::class, function (): never {
        throw new RuntimeException('audit indisponible');
    });

    $this->postJson(C::url($this->org, "/{$facture->id}/send"))->assertStatus(500);
    Event::forget('eloquent.creating: '.AuditLog::class);

    Mail::assertNothingQueued();
    Mail::assertNothingSent();
    expect(L::dans($this->org, fn () => Invoice::query()->find($facture->id)->sent_at))->toBeNull();
});

it('l\'e-mail n\'est mis en file qu\'au commit de la transaction englobante', function (): void {
    Mail::fake();
    $facture = C::emettre($this, $this->org, $this->partie);

    DB::beginTransaction();
    $this->postJson(C::url($this->org, "/{$facture->id}/send"))->assertOk();
    Mail::assertNothingQueued();
    DB::rollBack();

    Mail::assertNothingQueued();
    expect(L::dans($this->org, fn () => Invoice::query()->find($facture->id)->sent_at))->toBeNull();
});

it('l\'e-mail part par la file avec le PDF figé en pièce jointe, texte brut sans entités HTML', function (): void {
    $facture = C::emettre($this, $this->org, $this->partie);

    $this->postJson(C::url($this->org, "/{$facture->id}/send"))->assertOk();

    $messages = app(MailManager::class)->mailer()->getSymfonyTransport()->messages();
    expect($messages)->toHaveCount(1);
    $courriel = $messages[0]->getOriginalMessage();
    expect($courriel->getTextBody())->toContain('Agence du Port SAS vous transmet la facture '.$facture->number)
        ->and($courriel->getAttachments())->toHaveCount(1)
        ->and($courriel->getAttachments()[0]->getBody())->toBe(DocumentsContext::PDF);
});

it('le texte de l\'e-mail n\'échappe ni les apostrophes ni les esperluettes', function (): void {
    $facture = C::emettre($this, $this->org, $this->partie);
    $texte = (new InvoiceMail('Cabinet d\'Alembert & Fils', 'AF-2026-0001', true, null, (string) $this->org->id, (string) $facture->stored_file_id))->render();

    expect($texte)->toContain('Cabinet d\'Alembert & Fils vous transmet l\'avoir AF-2026-0001')
        ->and($texte)->not->toContain('&#039;')->not->toContain('&amp;')->not->toContain('&quot;');
});

it('une facture ne s\'envoie que trois fois par heure', function (): void {
    Mail::fake();
    $facture = C::emettre($this, $this->org, $this->partie);

    foreach (range(1, 3) as $i) {
        $this->postJson(C::url($this->org, "/{$facture->id}/send"))->assertOk();
    }

    $this->postJson(C::url($this->org, "/{$facture->id}/send"))->assertStatus(429);
    Mail::assertQueued(InvoiceMail::class, 3);

    $autre = C::emettre($this, $this->org, $this->partie);
    $this->postJson(C::url($this->org, "/{$autre->id}/send"))->assertOk();
});

it('une organisation est plafonnée en envois par heure, quel que soit l\'utilisateur', function (): void {
    Mail::fake();
    config(['invoicing.send.per_organization_per_hour' => 3]);
    $factures = array_map(fn (): Invoice => C::emettre($this, $this->org, $this->partie), range(1, 4));

    foreach (array_slice($factures, 0, 3) as $facture) {
        $this->postJson(C::url($this->org, "/{$facture->id}/send"))->assertOk();
    }

    $this->postJson(C::url($this->org, "/{$factures[3]->id}/send"))->assertStatus(429);
    Mail::assertQueued(InvoiceMail::class, 3);
});

it('l\'envoi reste limité à 10 par minute et par utilisateur', function (): void {
    Mail::fake();
    config(['invoicing.send.per_invoice_per_hour' => 100, 'invoicing.send.per_organization_per_hour' => 100]);
    $facture = C::emettre($this, $this->org, $this->partie);

    foreach (range(1, 10) as $i) {
        $this->postJson(C::url($this->org, "/{$facture->id}/send"))->assertOk();
    }

    $this->postJson(C::url($this->org, "/{$facture->id}/send"))->assertStatus(429);
});

it('le nom de l\'organisation perd ses caractères de contrôle dans l\'objet et le corps', function (): void {
    $courriel = new InvoiceMail("Agence\r\nBcc: pirate@example.test", 'FA-2026-0001', false, null, (string) $this->org->id, 'x');

    expect($courriel->organisation)->toBe('Agence Bcc: pirate@example.test');
});
