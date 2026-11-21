<?php

declare(strict_types=1);

use App\Modules\Banking\Jobs\ComputeBankSuggestions;
use App\Modules\Banking\Notifications\BankAccountChangedNotification;
use App\Modules\Organizations\Enums\MemberRole;
use Illuminate\Log\Events\MessageLogged;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Notification;
use Tests\Feature\Banking\BankingContext as B;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Rent\RentContext as C;

it('n\'écrit ni IBAN, ni libellé, ni contrepartie dans le journal d\'audit, les logs et les notifications', function (): void {
    Notification::fake();
    $journaux = [];
    Event::listen(MessageLogged::class, function (MessageLogged $m) use (&$journaux): void {
        $journaux[] = $m->message.json_encode($m->context);
    });

    ['org' => $org, 'bail' => $bail, 'compte' => $compte] = B::loyers($this);
    L::membre($org, MemberRole::Owner);
    C::payer($this, $org, $bail, 70000)->assertCreated();
    B::importer($this, $org, $compte, "Date;Libelle;Montant;Ref\n16/11/2026;VIR SECRET-LIBELLE JEAN DUPONT;700,00;REFSECRETE\n99/99/2026;LIGNE-REJETEE-SECRETE;1,00;R9\n")->assertCreated();
    $ligne = B::lignes($this, $org)['VIR SECRET-LIBELLE JEAN DUPONT'];
    B::envoyer($this, 'POST', B::url($org, "/lines/{$ligne['id']}/match"), ['journal_line_ids' => B::ecritures($this, $org, $compte), 'lock_version' => $ligne['lock_version']])->assertCreated();
    B::importer($this, $org, $compte, '<?php echo 1; ?> SECRET-HOSTILE')->assertStatus(422);

    $audit = DB::table('audit_logs')->get()->map(fn ($l) => json_encode($l))->implode('');
    $tout = $audit.implode('', $journaux);

    foreach (['SECRET-LIBELLE', 'JEAN DUPONT', 'REFSECRETE', 'LIGNE-REJETEE', 'SECRET-HOSTILE', B::IBAN, '30006000011234567890189'] as $interdit) {
        expect($tout)->not->toContain($interdit);
    }

    expect($audit)->toContain('banking.statement.imported')->toContain('banking.match.created');
    Notification::assertSentTimes(BankAccountChangedNotification::class, 1);
});

it('ne met jamais le libellé dans la file de calcul des propositions', function (): void {
    $payload = (new ReflectionClass(ComputeBankSuggestions::class))->getConstructor()?->getParameters();

    expect(array_map(fn ($p) => $p->getName(), $payload ?? []))->toBe(['organizationId', 'statementId']);
});
