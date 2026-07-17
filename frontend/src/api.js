import axios from "axios";

const BASE = "/api";

const api = axios.create({ baseURL: BASE });

export const getStats = () => api.get("/stats/").then((r) => r.data);
export const getRedeEvolucao = () => api.get("/rede/evolucao/").then((r) => r.data);
export const getCampuses = () => api.get("/campuses/").then((r) => r.data);
export const getCampus = (slug) => api.get(`/campuses/${slug}/`).then((r) => r.data);
export const getCampusRede = (slug) => api.get(`/campuses/${slug}/rede/`).then((r) => r.data);
export const getPesquisadores = (params) => api.get("/pesquisadores/", { params }).then((r) => r.data);
export const getPesquisador = (id) => api.get(`/pesquisadores/${id}/`).then((r) => r.data);
export const getEgoGraph = (id) => api.get(`/pesquisadores/${id}/ego-graph/`).then((r) => r.data);
export const getComunidades = () => api.get("/comunidades/").then((r) => r.data);
export const getAreas = () => api.get("/areas/").then((r) => r.data);
export const getArea = (nome) => api.get("/areas/detail/", { params: { nome } }).then((r) => r.data);
export const getAreaCoocorrencia = (nome) => api.get("/areas/coocorrencia/", { params: { nome } }).then((r) => r.data);
export const search = (q) => api.get("/search/", { params: { q } }).then((r) => r.data);
