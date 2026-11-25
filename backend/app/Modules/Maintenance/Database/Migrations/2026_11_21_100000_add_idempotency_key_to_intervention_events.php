<?php

declare(strict_types=1);

use App\Shared\Database\Checks;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const array COLONNES_FIGEES = ['id', 'organization_id', 'intervention_id', 'kind', 'actor_kind', 'actor_user_id', 'metadata', 'visible_to_owner', 'visible_to_tenant', 'created_at'];

    public function up(): void
    {
        Schema::table('intervention_events', function (Blueprint $table): void {
            $table->string('idempotency_key', 64)->nullable()->after('metadata');
            $table->unique(['organization_id', 'actor_user_id', 'idempotency_key'], 'intervention_events_org_actor_idem_unique');
        });

        Checks::add('intervention_events', 'idempotency_actor', 'idempotency_key IS NULL OR actor_user_id IS NOT NULL');
        $this->recreerVerrou([...self::COLONNES_FIGEES, 'idempotency_key']);
    }

    public function down(): void
    {
        if (DB::table('intervention_events')->whereNotNull('idempotency_key')->exists()) {
            throw new RuntimeException('Des commentaires portent une clé d\'idempotence : la migration ne se défait pas sans perdre cette trace.');
        }

        $this->recreerVerrou(self::COLONNES_FIGEES);

        if (in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            DB::statement('ALTER TABLE intervention_events DROP CHECK intervention_events_idempotency_actor_check');
        }

        Schema::table('intervention_events', function (Blueprint $table): void {
            $table->dropUnique('intervention_events_org_actor_idem_unique');
            $table->dropColumn('idempotency_key');
        });
    }

    /**
     * Même règle que la création de la table : seul le texte d'un commentaire du locataire peut être remplacé par « [effacé] »,
     * toute autre colonne, la clé comprise, reste figée.
     *
     * @param  list<string>  $figees
     */
    private function recreerVerrou(array $figees): void
    {
        $pilote = DB::getDriverName();

        if ($pilote !== 'sqlite' && ! in_array($pilote, ['mysql', 'mariadb'], true)) {
            throw new RuntimeException('Pilote de base sans verrou : '.$pilote);
        }

        $sqlite = $pilote === 'sqlite';
        $different = implode(' OR ', array_map(fn (string $c): string => $sqlite ? "NEW.{$c} IS NOT OLD.{$c}" : "NOT (NEW.{$c} <=> OLD.{$c})", $figees));
        $texte = $sqlite ? "NEW.text IS '[effacé]'" : "NEW.text <=> '[effacé]'";
        $condition = "NOT (OLD.actor_kind = 'tenant' AND OLD.kind = 'comment' AND {$texte} AND NOT ({$different}))";
        $message = 'intervention_events est en ajout seul';

        DB::connection()->getPdo()->exec('DROP TRIGGER intervention_events_sans_modification');
        DB::connection()->getPdo()->exec($sqlite
            ? "CREATE TRIGGER intervention_events_sans_modification BEFORE UPDATE ON intervention_events FOR EACH ROW WHEN ({$condition}) BEGIN SELECT RAISE(ABORT, '{$message}'); END"
            : "CREATE TRIGGER intervention_events_sans_modification BEFORE UPDATE ON intervention_events FOR EACH ROW IF ({$condition}) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '{$message}'; END IF");
    }
};
