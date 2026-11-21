import { describe, expect, it } from 'vitest';
import { CONTACT_CSV_TEMPLATE, parseContactsCsv } from './importCsv';

describe('parseContactsCsv', () => {
  it('lit le modèle fourni : une société et une personne, avec numéros de ligne du fichier', () => {
    const report = parseContactsCsv(CONTACT_CSV_TEMPLATE);
    expect(report.fatal).toBeNull();
    expect(report.rejected).toEqual([]);
    expect(report.accepted).toEqual([
      {
        line: 2,
        label: 'Plomberie Sanvi',
        row: {
          kind: 'company',
          company_name: 'Plomberie Sanvi',
          note: 'Intervient sous 48 h',
          contact_points: [
            { type: 'email', value: 'contact@plomberie-sanvi.fr', label: 'Rodrigue Sanvi', primary: true },
            { type: 'phone', value: '+33 6 12 40 18 77', label: 'Rodrigue Sanvi', primary: true },
          ],
        },
      },
      { line: 3, label: 'Camille Dubois', row: { kind: 'person', last_name: 'Dubois', first_name: 'Camille', contact_points: [{ type: 'email', value: 'camille.dubois@exemple.fr', label: null, primary: true }] } },
    ]);
  });

  it('déduit le type sans colonne Type et reprend Nom comme raison sociale d’une société', () => {
    const report = parseContactsCsv('Nom,Société\nDubois,\nSanvi,Plomberie Sanvi\n');
    expect(report.accepted.map((candidate) => candidate.row)).toEqual([
      { kind: 'person', last_name: 'Dubois' },
      { kind: 'company', company_name: 'Plomberie Sanvi' },
    ]);
    const typed = parseContactsCsv('Type;Nom\nSociété;Allianz\n');
    expect(typed.accepted[0]?.row).toEqual({ kind: 'company', company_name: 'Allianz' });
  });

  it('écarte les lignes invalides avec leur numéro et leurs motifs, sans bloquer les autres', () => {
    const report = parseContactsCsv('Type;Nom;E-mail;Notes\nPersonne;Dubois;pas-un-mail;\nRobot;X;;\nPersonne;;;\nPersonne;Martin;m@exemple.fr;<script>\nPersonne;Bon;b@exemple.fr;ok\n');
    expect(report.rejected).toEqual([
      { line: 2, reasons: ['E-mail invalide.'] },
      { line: 3, reasons: ['Type inconnu : « Robot », attendu Personne ou Société.'] },
      { line: 4, reasons: ['Le nom est obligatoire pour une personne.'] },
      { line: 5, reasons: ['Notes : les caractères < et > ne sont pas autorisés.'] },
    ]);
    expect(report.accepted.map((candidate) => [candidate.line, candidate.label])).toEqual([[6, 'Bon']]);
  });

  it.each(['=1+1', '+SUM(A1)', '-2+3', '@cmd'])('écarte une cellule de texte qui commence par %j avec un message par colonne', (value) => {
    const report = parseContactsCsv(`Type;Nom;Prénom;Société;E-mail;Interlocuteur;Notes\nPersonne;${value};${value};;;${value};${value}\nSociété;X;;${value};;;\n`);
    expect(report.accepted).toEqual([]);
    expect(report.rejected[0]).toEqual({
      line: 2,
      reasons: ['Nom', 'Prénom', 'Interlocuteur', 'Notes'].map((label) => `${label} : une valeur ne peut pas commencer par =, +, - ou @ (formule de tableur).`),
    });
    expect(report.rejected[1]?.reasons).toEqual(['Société : une valeur ne peut pas commencer par =, +, - ou @ (formule de tableur).']);
  });

  it('écarte un e-mail qui commence par un caractère de formule', () => {
    const report = parseContactsCsv('Nom;E-mail\nDubois;=cmd@exemple.fr\n');
    expect(report.rejected).toEqual([{ line: 2, reasons: ['E-mail : une valeur ne peut pas commencer par =, +, - ou @ (formule de tableur).'] }]);
  });

  it.each(['+33 6 12 40 18 77', '(228) 90 12 34 56', '01.23.45.67.89', '0033/612-345-678'])('accepte le téléphone %j', (phone) => {
    const report = parseContactsCsv(`Nom;Téléphone\nDubois;${phone}\n`);
    expect(report.rejected).toEqual([]);
    expect(report.accepted[0]?.row.contact_points).toEqual([{ type: 'phone', value: phone, label: null, primary: true }]);
  });

  it.each(['=1+1', '@cmd', '-33612', '0612;34', 'appeler Paul', '06 12 34 56 78 90 12 34 56 78 90 12 34 56'])('refuse le téléphone %j', (phone) => {
    const report = parseContactsCsv(`Nom;Téléphone\nDubois;"${phone}"\n`);
    expect(report.accepted).toEqual([]);
    expect(report.rejected[0]?.reasons[0]).toMatch(/^Téléphone : /);
  });

  it('refuse un téléphone libre de 254 caractères', () => {
    const report = parseContactsCsv(`Nom;Téléphone\nDubois;${'1'.repeat(254)}\n`);
    expect(report.rejected).toEqual([{ line: 2, reasons: ['Téléphone : 32 caractères au plus.'] }]);
  });

  it('refuse un fichier vide, sans colonne de nom, sans ligne ou de plus de 500 lignes', () => {
    expect(parseContactsCsv('').fatal).toBe('Le fichier est vide.');
    expect(parseContactsCsv('E-mail\na@b.fr').fatal).toContain('« Nom » ou « Société »');
    expect(parseContactsCsv('Nom\n').fatal).toBe('Le fichier ne contient aucun contact.');
    const big = ['Nom', ...Array.from({ length: 501 }, (_, index) => `N${String(index)}`)].join('\n');
    expect(parseContactsCsv(big).fatal).toContain('500 lignes');
    const limit = ['Nom', ...Array.from({ length: 500 }, (_, index) => `N${String(index)}`)].join('\n');
    expect(parseContactsCsv(limit).accepted).toHaveLength(500);
  });

  it('gère les champs entre guillemets et le BOM', () => {
    const report = parseContactsCsv('﻿Nom;Notes\n"Dubois";"Rappeler ; avant 18 h"\n');
    expect(report.accepted[0]?.row).toEqual({ kind: 'person', last_name: 'Dubois', note: 'Rappeler ; avant 18 h' });
  });
});
